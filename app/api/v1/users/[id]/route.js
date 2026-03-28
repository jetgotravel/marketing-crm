import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound, dbError } from '../../_lib/errors.js';
import { isValidEmail, clampString } from '../../_lib/validate.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('users')
    .select('id, tenant_id, email, name, role, gmail_connected, created_at, updated_at')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('User');

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

  const updates = {};
  if (body.name !== undefined) updates.name = clampString(body.name, 255);
  if (body.email !== undefined) {
    if (!isValidEmail(body.email)) return badRequest('Invalid email format');
    updates.email = body.email.toLowerCase().trim();
  }
  if (body.role !== undefined) {
    if (!['owner', 'admin', 'member'].includes(body.role)) {
      return badRequest('role must be owner, admin, or member');
    }
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select('id, tenant_id, email, name, role, gmail_connected, created_at, updated_at')
    .single();

  if (error || !data) return notFound('User');

  return NextResponse.json({ data });
}
