import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { logActivity } from '../_lib/activities.js';
import { unauthorized, badRequest, conflict, errorResponse } from '../_lib/errors.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const tags = searchParams.get('tags');
  const q = searchParams.get('q');

  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);
  if (tags) query = query.overlaps('tags', tags.split(','));
  if (q) query = query.or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`);

  const { data, error, count } = await query;

  if (error) return errorResponse(error.message);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit),
    },
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

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      tenant_id: auth.tenant_id,
      email: body.email.toLowerCase().trim(),
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      company: body.company || null,
      title: body.title || null,
      phone: body.phone || null,
      linkedin_url: body.linkedin_url || null,
      source: body.source || 'manual',
      tags: body.tags || [],
      custom_fields: body.custom_fields || {},
      score: body.score || 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return conflict('Contact with this email already exists for this tenant');
    return errorResponse(error.message);
  }

  await logActivity(auth.tenant_id, {
    contactId: data.id,
    type: 'contact_created',
    metadata: { email: data.email, source: data.source },
  });

  return NextResponse.json({ data }, { status: 201 });
}
