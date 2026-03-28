import { NextResponse } from 'next/server';
import supabase from '../../_lib/db.js';
import { sendGmail } from '../../_lib/gmail.js';
import { renderTemplate } from '../../_lib/template-render.js';
import { logActivity } from '../../_lib/activities.js';

/**
 * Process send queue: populate from due enrollments, then send pending items.
 * Called by Vercel Cron every minute.
 * Secured by CRON_SECRET header (Vercel sets Authorization header for cron jobs).
 */
export async function GET(req) {
  // Vercel Cron uses Authorization header; also support x-cron-secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${expectedSecret}` && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 1: Populate the send queue from due enrollments
  const { error: rpcError } = await supabase.rpc('populate_send_queue');
  if (rpcError) {
    console.error('populate_send_queue error:', rpcError.message);
    // Continue anyway — there may be existing pending items to process
  }

  // Step 2: Process pending items
  const batchSize = 10;
  const now = new Date();

  // Fetch pending items that are due
  const { data: items, error: fetchError } = await supabase
    .from('send_queue')
    .select(`
      id, tenant_id, enrollment_id, step_id, user_id, contact_id, scheduled_for,
      contacts:contact_id ( id, email, first_name, last_name, company, title, phone, linkedin_url, source, status, score, seniority, department, city, country, photo_url, custom_fields ),
      steps:step_id ( id, subject, body_template, step_order, variant_key, sequence_id ),
      sequences_via_enrollment:enrollment_id ( sequence_id, sequences:sequence_id ( send_window_start, send_window_end, skip_weekends ) )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ data: { processed: 0 } });
  }

  // Mark as processing
  const itemIds = items.map((i) => i.id);
  await supabase
    .from('send_queue')
    .update({ status: 'processing' })
    .in('id', itemIds);

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (const item of items) {
    try {
      const contact = item.contacts;
      const step = item.steps;

      if (!contact || !step) {
        await supabase.from('send_queue').update({ status: 'failed', error: 'Missing contact or step data' }).eq('id', item.id);
        results.failed++;
        continue;
      }

      // Render template
      const subject = renderTemplate(step.subject || '', contact);
      const body = renderTemplate(step.body_template || '', contact);

      // Send via Gmail
      const { messageId, threadId } = await sendGmail(item.user_id, {
        to: contact.email,
        subject,
        htmlBody: body,
      });

      // Mark sent
      await supabase
        .from('send_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', item.id);

      // Log to emails table for thread tracking
      await supabase.from('emails').insert({
        tenant_id: item.tenant_id,
        user_id: item.user_id,
        contact_id: item.contact_id,
        sequence_id: step.sequence_id,
        step_id: step.id,
        enrollment_id: item.enrollment_id,
        direction: 'sent',
        subject,
        body_snippet: body.replace(/<[^>]*>/g, '').substring(0, 200),
        gmail_message_id: messageId,
        gmail_thread_id: threadId,
        read: true,
      });

      // Log activity
      await logActivity(item.tenant_id, {
        contactId: item.contact_id,
        type: 'gmail_sent',
        metadata: {
          step_id: step.id,
          step_order: step.step_order,
          variant_key: step.variant_key,
          subject,
          gmail_message_id: messageId,
          gmail_thread_id: threadId,
          sender_user_id: item.user_id,
        },
      });

      // Check if enrollment is done (no next_step_at means last step)
      const { data: enrollment } = await supabase
        .from('sequence_enrollments')
        .select('next_step_at')
        .eq('id', item.enrollment_id)
        .single();

      if (enrollment && !enrollment.next_step_at) {
        await supabase
          .from('sequence_enrollments')
          .update({ status: 'completed' })
          .eq('id', item.enrollment_id);

        await logActivity(item.tenant_id, {
          contactId: item.contact_id,
          type: 'sequence_completed',
          metadata: { sequence_id: step.sequence_id, enrollment_id: item.enrollment_id },
        });
      }

      results.sent++;
    } catch (err) {
      await supabase
        .from('send_queue')
        .update({ status: 'failed', error: err.message })
        .eq('id', item.id);

      await logActivity(item.tenant_id, {
        contactId: item.contact_id,
        type: 'gmail_failed',
        metadata: { step_id: item.step_id, error: err.message, sender_user_id: item.user_id },
      });

      results.failed++;
    }
  }

  return NextResponse.json({ data: results });
}
