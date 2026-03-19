import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { unauthorized, badRequest, errorResponse } from '../_lib/errors.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('lists')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return errorResponse(error.message);

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

  if (!body.name) return badRequest('name is required');

  const listType = body.list_type || 'static';
  if (!['static', 'dynamic'].includes(listType)) {
    return badRequest('list_type must be static or dynamic');
  }

  if (listType === 'dynamic') {
    if (!body.filter_rules || !Array.isArray(body.filter_rules.conditions)) {
      return badRequest('Dynamic lists require filter_rules with conditions array');
    }
  }

  const { data, error } = await supabase
    .from('lists')
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name,
      description: body.description || null,
      list_type: listType,
      filter_rules: body.filter_rules || { conditions: [] },
    })
    .select()
    .single();

  if (error) return errorResponse(error.message);

  return NextResponse.json({ data }, { status: 201 });
}
