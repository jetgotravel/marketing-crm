import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound, errorResponse } from '../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('List');

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

  const { data: existing } = await supabase
    .from('lists')
    .select('list_type')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!existing) return notFound('List');

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.filter_rules !== undefined) {
    if (existing.list_type !== 'dynamic') {
      return badRequest('filter_rules can only be set on dynamic lists');
    }
    if (!body.filter_rules.conditions || !Array.isArray(body.filter_rules.conditions)) {
      return badRequest('filter_rules must include conditions array');
    }
    updates.filter_rules = body.filter_rules;
  }

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('lists')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return errorResponse(error.message);

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('lists')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('List');

  return NextResponse.json({ data: { deleted: true, id } });
}
