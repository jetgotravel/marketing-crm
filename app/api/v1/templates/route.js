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
  const category = searchParams.get('category');

  let query = supabase
    .from('email_templates')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);

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

  if (!body.name) return badRequest('name is required');
  if (!body.subject_template) return badRequest('subject_template is required');
  if (!body.body_template) return badRequest('body_template is required');

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      tenant_id: auth.tenant_id,
      name: body.name,
      subject_template: body.subject_template,
      body_template: body.body_template,
      category: body.category || 'cold_outreach',
    })
    .select()
    .single();

  if (error) return errorResponse(error.message);

  return NextResponse.json({ data }, { status: 201 });
}
