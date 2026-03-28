import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound, dbError } from '../../_lib/errors.js';

/**
 * Bulk direct send — queue unique emails for multiple contacts.
 * All go to pending_review. Must be activated from dashboard with password.
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

  const { emails } = body;
  if (!Array.isArray(emails) || emails.length === 0) {
    return badRequest('emails must be a non-empty array of {contact_id, subject, body}');
  }
  if (emails.length > 500) return badRequest('Maximum 500 emails per bulk send');
  if (!body.sender_user_id) return badRequest('sender_user_id is required');

  // Verify sender
  const { data: sender } = await supabase
    .from('users')
    .select('id, gmail_connected')
    .eq('id', body.sender_user_id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sender) return notFound('Sender user');

  // Validate each email has required fields
  const invalid = emails.filter(e => !e.contact_id || !e.subject || !e.body);
  if (invalid.length > 0) {
    return badRequest(`${invalid.length} email(s) missing contact_id, subject, or body`);
  }

  // Create send queue entries as pending_review
  const rows = emails.map(e => ({
    tenant_id: auth.tenant_id,
    user_id: body.sender_user_id,
    contact_id: e.contact_id,
    send_type: 'direct',
    custom_subject: e.subject,
    custom_body: e.body,
    status: 'pending',
    scheduled_for: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('send_queue')
    .insert(rows)
    .select();

  if (error) return dbError(error);

  return NextResponse.json({
    data: {
      queued: data.length,
      status: 'pending',
      message: 'Direct emails queued. Activate from the CRM dashboard to send.',
      send_queue_ids: data.map(d => d.id),
    },
  }, { status: 201 });
}
