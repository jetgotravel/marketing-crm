import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, errorResponse } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify company belongs to tenant
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (companyError || !company) return notFound('Company');

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  // Get contact IDs from join table, then fetch contacts
  const { data: links, error: linkError } = await supabase
    .from('contact_companies')
    .select('contact_id')
    .eq('company_id', id);

  if (linkError) return errorResponse(linkError.message);

  const contactIds = links.map((l) => l.contact_id);

  if (contactIds.length === 0) {
    return NextResponse.json({
      data: [],
      pagination: { page, limit, total: 0, pages: 0 },
    });
  }

  const { data, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .in('id', contactIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return errorResponse(error.message);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit),
    },
  });
}
