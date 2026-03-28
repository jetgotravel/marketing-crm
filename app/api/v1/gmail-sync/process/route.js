import { NextResponse } from 'next/server';
import supabase from '../../_lib/db.js';
import { getTenantGoogleCredentials, refreshAccessToken } from '../../_lib/google-oauth.js';
import { logActivity } from '../../_lib/activities.js';

import { authenticate } from '../../_lib/auth.js';

/**
 * Gmail sync: detect replies, manual replies, and bounces.
 * Called by Vercel Cron every 2 minutes, or manually via API key.
 */
export async function GET(req) {
  // Allow Vercel cron (CRON_SECRET) or API key auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  const apiKeyAuth = await authenticate(req);

  const isCron = authHeader === `Bearer ${expectedSecret}` || cronSecret === expectedSecret;
  const isApiKey = !apiKeyAuth.error;

  if (!isCron && !isApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all Gmail-connected users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, tenant_id, email, google_refresh_token, gmail_history_id')
    .eq('gmail_connected', true)
    .not('google_refresh_token', 'is', null);

  if (usersError || !users) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const results = { users_processed: 0, messages_found: 0, replies: 0, manual_replies: 0, bounces: 0, errors: 0 };

  for (const user of users) {
    try {
      let credentials;
      try {
        credentials = await getTenantGoogleCredentials(user.tenant_id);
      } catch {
        results.users_processed++;
        continue;
      }

      let accessToken;
      try {
        accessToken = await refreshAccessToken(user.google_refresh_token, credentials.clientId, credentials.clientSecret);
      } catch (err) {
        console.error(`Token refresh failed for user ${user.id}:`, err.message);
        results.errors++;
        results.users_processed++;
        continue;
      }

      // First run: seed history ID, then do a thread check for any existing replies
      if (!user.gmail_history_id) {
        const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        if (profile.historyId) {
          await supabase.from('users').update({ gmail_history_id: profile.historyId }).eq('id', user.id);
        }
        // Fall through to thread check below instead of continuing
      }

      // --- Thread check: scan tracked threads for unsynced messages ---
      const { data: trackedThreads } = await supabase
        .from('emails')
        .select('gmail_thread_id, contact_id, sequence_id, enrollment_id')
        .eq('user_id', user.id)
        .eq('direction', 'sent');

      if (trackedThreads && trackedThreads.length > 0) {
        // Deduplicate threads
        const uniqueThreads = new Map();
        for (const t of trackedThreads) {
          if (!uniqueThreads.has(t.gmail_thread_id)) uniqueThreads.set(t.gmail_thread_id, t);
        }

        for (const [threadId, tracked] of uniqueThreads) {
          try {
            const threadRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (!threadRes.ok) continue;
            const threadData = await threadRes.json();

            for (const msg of threadData.messages || []) {
              // Skip if already in DB
              const { data: existing } = await supabase
                .from('emails')
                .select('id')
                .eq('gmail_message_id', msg.id)
                .maybeSingle();
              if (existing) continue;

              const headers = msg.payload?.headers || [];
              const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
              const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
              const snippet = msg.snippet || '';

              const senderMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader.trim()];
              const senderEmail = (senderMatch[1] || '').toLowerCase();

              // Skip bounces in thread check (handled in history pass)
              if (senderEmail.includes('mailer-daemon') || senderEmail.includes('postmaster')) continue;

              const isFromUser = senderEmail === user.email.toLowerCase();

              if (isFromUser) {
                await supabase.from('emails').insert({
                  tenant_id: user.tenant_id, user_id: user.id, contact_id: tracked.contact_id,
                  direction: 'manual_reply', subject: subjectHeader,
                  body_snippet: snippet.substring(0, 200),
                  gmail_message_id: msg.id, gmail_thread_id: threadId, read: true,
                });
                results.manual_replies++;
              } else {
                await supabase.from('emails').insert({
                  tenant_id: user.tenant_id, user_id: user.id, contact_id: tracked.contact_id,
                  direction: 'received', subject: subjectHeader,
                  body_snippet: snippet.substring(0, 200),
                  gmail_message_id: msg.id, gmail_thread_id: threadId, read: false,
                });

                if (tracked.enrollment_id) {
                  const { data: enrollment } = await supabase
                    .from('sequence_enrollments')
                    .select('id, sequence_id, current_step_order')
                    .eq('id', tracked.enrollment_id)
                    .in('status', ['active', 'paused'])
                    .maybeSingle();

                  if (enrollment) {
                    await supabase.from('sequence_enrollments').update({ status: 'replied' }).eq('id', enrollment.id);
                    await supabase.from('send_queue').update({ status: 'cancelled' }).eq('enrollment_id', enrollment.id).eq('status', 'pending');
                    await logActivity(user.tenant_id, {
                      contactId: tracked.contact_id, type: 'email_replied',
                      metadata: { sequence_id: enrollment.sequence_id, enrollment_id: enrollment.id, gmail_thread_id: threadId, gmail_message_id: msg.id },
                    });
                  }
                }

                if (tracked.contact_id) {
                  await supabase.from('contacts').update({ status: 'replied' }).eq('id', tracked.contact_id).in('status', ['new', 'contacted']);
                }
                results.replies++;
              }
              results.messages_found++;
            }
          } catch (threadErr) {
            console.error(`Thread check error for ${threadId}:`, threadErr.message);
          }
        }
      }

      // --- History-based sync for new messages in untracked threads ---
      if (!user.gmail_history_id) {
        results.users_processed++;
        continue;
      }

      const historyUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
      historyUrl.searchParams.set('startHistoryId', user.gmail_history_id);
      historyUrl.searchParams.set('historyTypes', 'messageAdded');
      historyUrl.searchParams.set('maxResults', '100');

      const historyRes = await fetch(historyUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const historyData = await historyRes.json();

      // 404 = history ID too old, reseed
      if (historyRes.status === 404) {
        const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const profile = await profileRes.json();
        if (profile.historyId) {
          await supabase.from('users').update({ gmail_history_id: profile.historyId }).eq('id', user.id);
        }
        results.users_processed++;
        continue;
      }

      if (!historyRes.ok) {
        console.error(`Gmail history.list failed for user ${user.id}:`, historyData);
        results.errors++;
        results.users_processed++;
        continue;
      }

      const newHistoryId = historyData.historyId;

      // Extract message IDs from history
      const messageIds = new Set();
      if (historyData.history) {
        for (const record of historyData.history) {
          if (record.messagesAdded) {
            for (const added of record.messagesAdded) {
              messageIds.add(added.message.id);
            }
          }
        }
      }

      for (const msgId of messageIds) {
        try {
          // Skip if already processed
          const { data: existing } = await supabase
            .from('emails')
            .select('id')
            .eq('gmail_message_id', msgId)
            .maybeSingle();

          if (existing) continue;

          // Fetch message metadata
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const msg = await msgRes.json();
          if (!msgRes.ok) continue;

          const threadId = msg.threadId;
          const headers = msg.payload?.headers || [];
          const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
          const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
          const snippet = msg.snippet || '';

          // Only process threads we're tracking
          const { data: knownEmails } = await supabase
            .from('emails')
            .select('contact_id, sequence_id, enrollment_id')
            .eq('gmail_thread_id', threadId)
            .limit(1);

          if (!knownEmails || knownEmails.length === 0) continue;

          const tracked = knownEmails[0];
          results.messages_found++;

          // Extract sender email
          const senderMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader.trim()];
          const senderEmail = (senderMatch[1] || '').toLowerCase();

          // Detect bounces
          if (senderEmail.includes('mailer-daemon') || senderEmail.includes('postmaster')) {
            await supabase.from('emails').insert({
              tenant_id: user.tenant_id,
              user_id: user.id,
              contact_id: tracked.contact_id,
              sequence_id: tracked.sequence_id,
              enrollment_id: tracked.enrollment_id,
              direction: 'received',
              subject: subjectHeader,
              body_snippet: snippet.substring(0, 200),
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              read: false,
            });

            if (tracked.contact_id) {
              await supabase.from('contacts').update({ status: 'bounced' }).eq('id', tracked.contact_id);
            }
            if (tracked.contact_id) {
              await supabase.from('send_queue').update({ status: 'cancelled' }).eq('contact_id', tracked.contact_id).eq('status', 'pending');
            }
            if (tracked.enrollment_id) {
              await supabase.from('sequence_enrollments').update({ status: 'completed' }).eq('id', tracked.enrollment_id).in('status', ['active', 'paused']);
            }

            await logActivity(user.tenant_id, {
              contactId: tracked.contact_id,
              type: 'email_bounced',
              metadata: { gmail_thread_id: threadId, gmail_message_id: msgId },
            });

            results.bounces++;
            continue;
          }

          const isFromUser = senderEmail === user.email.toLowerCase();

          if (isFromUser) {
            // Manual reply from Gmail (user replied outside the CRM)
            await supabase.from('emails').insert({
              tenant_id: user.tenant_id,
              user_id: user.id,
              contact_id: tracked.contact_id,
              direction: 'manual_reply',
              subject: subjectHeader,
              body_snippet: snippet.substring(0, 200),
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              read: true,
            });
            results.manual_replies++;
          } else {
            // Reply from the contact
            await supabase.from('emails').insert({
              tenant_id: user.tenant_id,
              user_id: user.id,
              contact_id: tracked.contact_id,
              direction: 'received',
              subject: subjectHeader,
              body_snippet: snippet.substring(0, 200),
              gmail_message_id: msgId,
              gmail_thread_id: threadId,
              read: false,
            });

            // Auto-mark sequence enrollment as replied
            if (tracked.enrollment_id) {
              const { data: enrollment } = await supabase
                .from('sequence_enrollments')
                .select('id, sequence_id, current_step_order')
                .eq('id', tracked.enrollment_id)
                .in('status', ['active', 'paused'])
                .maybeSingle();

              if (enrollment) {
                await supabase.from('sequence_enrollments').update({ status: 'replied' }).eq('id', enrollment.id);
                await supabase.from('send_queue').update({ status: 'cancelled' }).eq('enrollment_id', enrollment.id).eq('status', 'pending');

                await logActivity(user.tenant_id, {
                  contactId: tracked.contact_id,
                  type: 'email_replied',
                  metadata: {
                    sequence_id: enrollment.sequence_id,
                    enrollment_id: enrollment.id,
                    step_order: enrollment.current_step_order,
                    gmail_thread_id: threadId,
                    gmail_message_id: msgId,
                  },
                });
              }
            }

            // Update contact status to replied if new/contacted
            if (tracked.contact_id) {
              await supabase.from('contacts').update({ status: 'replied' }).eq('id', tracked.contact_id).in('status', ['new', 'contacted']);
            }

            results.replies++;
          }
        } catch (msgErr) {
          console.error(`Error processing message ${msgId} for user ${user.id}:`, msgErr.message);
          results.errors++;
        }
      }

      // Update history ID
      if (newHistoryId) {
        await supabase.from('users').update({ gmail_history_id: newHistoryId }).eq('id', user.id);
      }

      results.users_processed++;
    } catch (userErr) {
      console.error(`Error syncing user ${user.id}:`, userErr.message);
      results.errors++;
      results.users_processed++;
    }
  }

  return NextResponse.json({ data: results });
}
