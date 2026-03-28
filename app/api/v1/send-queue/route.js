import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { unauthorized, dbError } from '../_lib/errors.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('send_queue')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('scheduled_for', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (userId) query = query.eq('user_id', userId);

  const { data, error, count } = await query;
  if (error) return dbError(error);

  return NextResponse.json({
    data,
    pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) },
  });
}
