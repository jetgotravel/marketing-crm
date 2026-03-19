import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound } from '../../_lib/errors.js';
import { clampString, isValidNumber, isValidEnum, isValidDate, ENUMS } from '../../_lib/validate.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Deal');

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

  if (body.value !== undefined && (!isValidNumber(body.value) || body.value < 0)) {
    return badRequest('value must be a non-negative number');
  }
  if (body.stage && !isValidEnum(body.stage, ENUMS.DEAL_STAGES)) {
    return badRequest(`Invalid stage. Must be one of: ${ENUMS.DEAL_STAGES.join(', ')}`);
  }
  if (body.expected_close_date && !isValidDate(body.expected_close_date)) {
    return badRequest('Invalid expected_close_date format');
  }

  const allowed = ['deal_name', 'value', 'contact_id', 'company_id', 'expected_close_date', 'notes'];
  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.deal_name) updates.deal_name = clampString(updates.deal_name, 255);
  if (updates.notes) updates.notes = clampString(updates.notes, 5000);
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Deal');

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Deal');

  return NextResponse.json({ data });
}
