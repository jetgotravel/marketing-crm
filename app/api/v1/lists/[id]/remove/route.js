import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { logActivity } from '../../../_lib/activities.js';
import { unauthorized, badRequest, notFound, errorResponse } from '../../../_lib/errors.js';

export async function POST(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data: list } = await supabase
    .from('lists')
    .select('list_type')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!list) return notFound('List');
  if (list.list_type !== 'static') return badRequest('Can only remove contacts from static lists');

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const contactIds = Array.isArray(body.contact_ids) ? body.contact_ids : body.contact_id ? [body.contact_id] : [];
  if (contactIds.length === 0) return badRequest('contact_id or contact_ids is required');

  const { data: removed, error } = await supabase
    .from('list_contacts')
    .delete()
    .eq('list_id', id)
    .in('contact_id', contactIds)
    .select('contact_id');

  if (error) return errorResponse(error.message);

  // Log activity for each removed contact
  for (const row of removed || []) {
    await logActivity(auth.tenant_id, {
      contactId: row.contact_id,
      type: 'list_removed',
      metadata: { list_id: id },
    });
  }

  return NextResponse.json({ data: { removed: (removed || []).length } });
}
