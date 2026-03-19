import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound } from '../../_lib/errors.js';
import { clampString, isValidEnum, ENUMS } from '../../_lib/validate.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Template');

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

  const allowedFields = ['name', 'subject_template', 'body_template', 'category'];

  if (body.category && !isValidEnum(body.category, ENUMS.TEMPLATE_CATEGORIES)) {
    return badRequest(`Invalid category. Must be one of: ${ENUMS.TEMPLATE_CATEGORIES.join(', ')}`);
  }

  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (updates.name) updates.name = clampString(updates.name, 255);
  if (updates.subject_template) updates.subject_template = clampString(updates.subject_template, 500);
  if (updates.body_template) updates.body_template = clampString(updates.body_template, 50000);

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Template');

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Template');

  return NextResponse.json({ data: { deleted: true, id } });
}
