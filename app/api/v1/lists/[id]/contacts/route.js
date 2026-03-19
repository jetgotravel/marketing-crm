import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { evaluateFilterRules } from '../../../_lib/filter-engine.js';
import { unauthorized, notFound, dbError } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  const { data: list } = await supabase
    .from('lists')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!list) return notFound('List');

  if (list.list_type === 'dynamic') {
    const result = await evaluateFilterRules(auth.tenant_id, list.filter_rules, { page, limit });
    if (result.error) return dbError(result.error);

    return NextResponse.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.count,
        total_pages: Math.ceil(result.count / limit),
      },
    });
  }

  // Static list — join through list_contacts
  const { data, error, count } = await supabase
    .from('list_contacts')
    .select('contact_id, added_at, contacts(*)', { count: 'exact' })
    .eq('list_id', id)
    .order('added_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(error);

  const contacts = data.map(row => ({
    ...row.contacts,
    added_at: row.added_at,
  }));

  return NextResponse.json({
    data: contacts,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit),
    },
  });
}
