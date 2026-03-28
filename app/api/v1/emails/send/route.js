import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { sendGmail } from '../../_lib/gmail.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, notFound, dbError } from '../../_lib/errors.js';

/**
 * Send a single direct email (not part of a sequence).
 * Sends immediately — no pending_review for single sends.
 */
export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.contact_id) return badRequest('contact_id is required');
  if (!body.sender_user_id) return badRequest('sender_user_id is required');
  if (!body.subject) return badRequest('subject is required');
  if (!body.body) return badRequest('body is required');

  // Verify contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, email, first_name')
    .eq('id', body.contact_id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!contact) return notFound('Contact');

  // Verify sender
  const { data: sender } = await supabase
    .from('users')
    .select('id, email, gmail_connected')
    .eq('id', body.sender_user_id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sender) return notFound('Sender user');
  if (!sender.gmail_connected) return badRequest('Sender has not connected Gmail');

  try {
    const { messageId, threadId } = await sendGmail(sender.id, {
      to: contact.email,
      subject: body.subject,
      htmlBody: body.body,
    });

    // Log in emails table
    await supabase.from('emails').insert({
      tenant_id: auth.tenant_id,
      user_id: sender.id,
      contact_id: contact.id,
      direction: 'sent',
      subject: body.subject,
      body_snippet: body.body.replace(/<[^>]*>/g, '').substring(0, 200),
      gmail_message_id: messageId,
      gmail_thread_id: threadId,
      read: true,
    });

    await logActivity(auth.tenant_id, {
      contactId: contact.id,
      type: 'gmail_sent',
      metadata: {
        subject: body.subject,
        gmail_message_id: messageId,
        gmail_thread_id: threadId,
        sender_user_id: sender.id,
        direct: true,
      },
    });

    return NextResponse.json({
      data: {
        sent: true,
        contact_email: contact.email,
        gmail_message_id: messageId,
        gmail_thread_id: threadId,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: `Send failed: ${err.message}`,
    }, { status: 500 });
  }
}
