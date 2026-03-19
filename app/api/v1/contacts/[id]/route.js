import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, notFound, errorResponse } from '../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Contact');

  return NextResponse.json({ data });
}

export async function PATCH(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Fetch current contact to detect status changes
  const { data: existing } = await supabase
    .from('contacts')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!existing) return notFound('Contact');

  const allowedFields = [
    'email', 'first_name', 'last_name', 'company', 'title',
    'phone', 'linkedin_url', 'source', 'status', 'tags',
    'custom_fields', 'score',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = field === 'email' ? body[field].toLowerCase().trim() : body[field];
    }
  }

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return errorResponse(error.message);

  // Log status change if status was updated
  if (updates.status && updates.status !== existing.status) {
    await logActivity(auth.tenant_id, {
      contactId: id,
      type: 'status_changed',
      metadata: { old_status: existing.status, new_status: updates.status },
    });
  }

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Contact');

  return NextResponse.json({ data: { deleted: true, id } });
}
