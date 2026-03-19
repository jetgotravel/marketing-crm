import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { logActivity } from '../_lib/activities.js';
import { unauthorized, badRequest, conflict, dbError } from '../_lib/errors.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const q = searchParams.get('q');

  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,domain.ilike.%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) return dbError(error);

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

  if (!body.name) return badRequest('name is required');

  const { data, error } = await supabase
    .from('companies')
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name,
      domain: body.domain || null,
      industry: body.industry || null,
      size_range: body.size_range || null,
      location: body.location || null,
      website: body.website || null,
      description: body.description || null,
      linkedin_url: body.linkedin_url || null,
      tags: body.tags || [],
      custom_fields: body.custom_fields || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return conflict('Company with this domain already exists for this tenant');
    return dbError(error);
  }

  await logActivity(auth.tenant_id, {
    companyId: data.id,
    type: 'company_created',
    metadata: { name: data.name, domain: data.domain },
  });

  return NextResponse.json({ data }, { status: 201 });
}
