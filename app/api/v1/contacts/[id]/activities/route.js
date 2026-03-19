import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, errorResponse } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify contact belongs to tenant
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!contact) return notFound('Contact');

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('activities')
    .select('*', { count: 'exact' })
    .eq('contact_id', id)
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq('activity_type', type);

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
