import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, dbError } from '../../_lib/errors.js';

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  let query = supabase
    .from('send_queue')
    .update({ status: 'pending', error: null })
    .eq('tenant_id', auth.tenant_id)
    .eq('status', 'failed');

  if (body.ids && Array.isArray(body.ids)) {
    query = query.in('id', body.ids);
  } else if (!body.all_failed) {
    return badRequest('Provide ids array or set all_failed: true');
  }

  const { data, error } = await query.select();
  if (error) return dbError(error);

  return NextResponse.json({ data: { retried: data.length, items: data } });
}
