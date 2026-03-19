import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, notFound, errorResponse } from '../../_lib/errors.js';
import { isValidEmail, isValidUUID, clampString, isValidNumber, isValidEnum, validateArray, ENUMS } from '../../_lib/validate.js';

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

  // Validate specific fields
  if (body.email !== undefined && !isValidEmail(body.email)) return badRequest('Invalid email format');
  if (body.source !== undefined && !isValidEnum(body.source, ENUMS.CONTACT_SOURCES)) {
    return badRequest(`Invalid source. Must be one of: ${ENUMS.CONTACT_SOURCES.join(', ')}`);
  }
  if (body.status !== undefined && !isValidEnum(body.status, ENUMS.CONTACT_STATUSES)) {
    return badRequest(`Invalid status. Must be one of: ${ENUMS.CONTACT_STATUSES.join(', ')}`);
  }
  if (body.score !== undefined && (!isValidNumber(body.score) || body.score < 0 || body.score > 1000)) {
    return badRequest('score must be a number between 0 and 1000');
  }
  if (body.tags !== undefined) {
    const validTags = validateArray(body.tags, 100);
    if (!validTags) return badRequest('tags must be an array');
    body.tags = validTags;
  }

  const stringLimits = { first_name: 255, last_name: 255, company: 255, title: 255, phone: 50, linkedin_url: 500 };
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      let val = body[field];
      if (field === 'email') val = val.toLowerCase().trim();
      else if (stringLimits[field]) val = clampString(val, stringLimits[field]);
      updates[field] = val;
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
