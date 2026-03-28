import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { unauthorized, badRequest, conflict, dbError } from '../_lib/errors.js';
import { isValidEmail, clampString } from '../_lib/validate.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('users')
    .select('id, tenant_id, email, name, role, gmail_connected, created_at, updated_at', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(error);

  return NextResponse.json({
    data,
    pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) },
  });
}

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.email) return badRequest('email is required');
  if (!isValidEmail(body.email)) return badRequest('Invalid email format');
  if (body.role && !['owner', 'admin', 'member'].includes(body.role)) {
    return badRequest('role must be owner, admin, or member');
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      tenant_id: auth.tenant_id,
      email: body.email.toLowerCase().trim(),
      name: clampString(body.name, 255) || null,
      role: body.role || 'member',
    })
    .select('id, tenant_id, email, name, role, gmail_connected, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === '23505') return conflict('User with this email already exists for this tenant');
    return dbError(error);
  }

  return NextResponse.json({ data }, { status: 201 });
}
