import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, notFound, dbError } from '../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { threadId } = await params;

  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .eq('tenant_id', auth.tenant_id)
    .eq('gmail_thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) return dbError(error);
  if (!data || data.length === 0) return notFound('Thread');

  return NextResponse.json({ data });
}
