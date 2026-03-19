import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, notFound, badRequest, dbError } from '../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('sequences')
    .select('*, sequence_steps(*)')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Sequence');

  // Sort steps by step_order
  if (data.sequence_steps) {
    data.sequence_steps.sort((a, b) => a.step_order - b.step_order || a.variant_key.localeCompare(b.variant_key));
  }

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

  // Verify ownership
  const { data: existing } = await supabase
    .from('sequences')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!existing) return notFound('Sequence');

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) {
    if (!['draft', 'active', 'paused', 'completed'].includes(body.status)) {
      return badRequest('Invalid status');
    }
    updates.status = body.status;
  }

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('sequences')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Sequence');

  return NextResponse.json({ data });
}
