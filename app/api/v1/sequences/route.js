import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { unauthorized, badRequest, dbError } from '../_lib/errors.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  let query = supabase
    .from('sequences')
    .select('*, sequence_steps(count), sequence_enrollments(count)', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;

  if (error) return dbError(error);

  // Flatten counts
  const enriched = (data || []).map(seq => ({
    ...seq,
    step_count: seq.sequence_steps?.[0]?.count || 0,
    enrolled_count: seq.sequence_enrollments?.[0]?.count || 0,
    sequence_steps: undefined,
    sequence_enrollments: undefined,
  }));

  return NextResponse.json({
    data: enriched,
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

  const insert = {
    tenant_id: auth.tenant_id,
    name: body.name,
    status: 'draft',
  };
  if (body.send_window_start !== undefined) insert.send_window_start = body.send_window_start;
  if (body.send_window_end !== undefined) insert.send_window_end = body.send_window_end;
  if (body.skip_weekends !== undefined) insert.skip_weekends = body.skip_weekends;
  if (body.daily_send_limit !== undefined) insert.daily_send_limit = body.daily_send_limit;
  if (body.cooldown_days !== undefined) insert.cooldown_days = body.cooldown_days;

  const { data, error } = await supabase
    .from('sequences')
    .insert(insert)
    .select()
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ data }, { status: 201 });
}
