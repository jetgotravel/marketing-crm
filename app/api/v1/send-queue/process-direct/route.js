import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { sendGmail } from '../../_lib/gmail.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest } from '../../_lib/errors.js';

/**
 * Process pending direct sends. Only callable from dashboard (requires _dashboard_confirmed).
 */
export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body._dashboard_confirmed) {
    return badRequest('Direct sends can only be activated from the CRM dashboard.');
  }

  // Get pending direct sends
  let query = supabase
    .from('send_queue')
    .select('id, tenant_id, user_id, contact_id, custom_subject, custom_body')
    .eq('tenant_id', auth.tenant_id)
    .eq('send_type', 'direct')
    .eq('status', 'pending');

  if (body.send_queue_ids && Array.isArray(body.send_queue_ids)) {
    query = query.in('id', body.send_queue_ids);
  }

  const { data: items } = await query;

  if (!items || items.length === 0) {
    return NextResponse.json({ data: { sent: 0, message: 'No pending direct sends' } });
  }

  // Get contact emails
  const contactIds = [...new Set(items.map(i => i.contact_id))];
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email')
    .in('id', contactIds);
  const contactMap = new Map((contacts || []).map(c => [c.id, c.email]));

  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await supabase.from('send_queue').update({ status: 'processing' }).eq('id', item.id);

      const contactEmail = contactMap.get(item.contact_id);
      if (!contactEmail) throw new Error('Contact email not found');

      const { messageId, threadId } = await sendGmail(item.user_id, {
        to: contactEmail,
        subject: item.custom_subject,
        htmlBody: item.custom_body,
      });

      await supabase.from('send_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id);

      await supabase.from('emails').insert({
        tenant_id: item.tenant_id,
        user_id: item.user_id,
        contact_id: item.contact_id,
        direction: 'sent',
        subject: item.custom_subject,
        body_snippet: item.custom_body?.replace(/<[^>]*>/g, '').substring(0, 200),
        gmail_message_id: messageId,
        gmail_thread_id: threadId,
        read: true,
      });

      await logActivity(item.tenant_id, {
        contactId: item.contact_id,
        type: 'gmail_sent',
        metadata: { subject: item.custom_subject, gmail_message_id: messageId, gmail_thread_id: threadId, sender_user_id: item.user_id, direct: true },
      });

      sent++;
    } catch (err) {
      await supabase.from('send_queue').update({ status: 'failed', error: err.message }).eq('id', item.id);
      failed++;
    }
  }

  return NextResponse.json({ data: { sent, failed, total: items.length } });
}
