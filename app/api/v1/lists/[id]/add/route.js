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
  if (list.list_type !== 'static') return badRequest('Can only add contacts to static lists');

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const contactIds = Array.isArray(body.contact_ids) ? body.contact_ids.slice(0, 500) : body.contact_id ? [body.contact_id] : [];
  if (contactIds.length === 0) return badRequest('contact_id or contact_ids is required');

  // Verify contacts belong to this tenant
  const { data: validContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', auth.tenant_id)
    .in('id', contactIds);

  const validIds = new Set((validContacts || []).map(c => c.id));
  const rows = contactIds
    .filter(cid => validIds.has(cid))
    .map(cid => ({ list_id: id, contact_id: cid }));

  if (rows.length === 0) return badRequest('No valid contact IDs provided');

  const { error } = await supabase
    .from('list_contacts')
    .upsert(rows, { onConflict: 'list_id,contact_id', ignoreDuplicates: true });

  if (error) return errorResponse(error.message);

  // Log activity for each added contact
  for (const cid of rows.map(r => r.contact_id)) {
    await logActivity(auth.tenant_id, {
      contactId: cid,
      type: 'list_added',
      metadata: { list_id: id },
    });
  }

  return NextResponse.json({ data: { added: rows.length } });
}
