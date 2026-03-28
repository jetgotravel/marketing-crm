import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, dbError } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify batch belongs to tenant
  const { data: batch } = await supabase
    .from('import_batches')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!batch) return notFound('Import batch');

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('import_batch_id', id)
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(error);

  return NextResponse.json({
    data,
    pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) },
  });
}
