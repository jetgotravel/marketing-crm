import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { unauthorized, badRequest, dbError } from '../_lib/errors.js';
import { escapeIlike } from '../_lib/validate.js';

const RESULTS_PER_TYPE = 5;

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length === 0) return badRequest('q (search query) is required');

  const term = `%${escapeIlike(q.trim())}%`;

  const [contacts, companies, deals] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, email, first_name, last_name, company, status')
      .eq('tenant_id', auth.tenant_id)
      .or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},company.ilike.${term}`)
      .order('created_at', { ascending: false })
      .limit(RESULTS_PER_TYPE),

    supabase
      .from('companies')
      .select('id, name, domain, industry')
      .eq('tenant_id', auth.tenant_id)
      .or(`name.ilike.${term},domain.ilike.${term}`)
      .order('created_at', { ascending: false })
      .limit(RESULTS_PER_TYPE),

    supabase
      .from('deals')
      .select('id, deal_name, value, stage')
      .eq('tenant_id', auth.tenant_id)
      .ilike('deal_name', term)
      .order('created_at', { ascending: false })
      .limit(RESULTS_PER_TYPE),
  ]);

  if (contacts.error) return dbError(contacts.error);
  if (companies.error) return dbError(companies.error);
  if (deals.error) return dbError(deals.error);

  return NextResponse.json({
    data: {
      contacts: contacts.data,
      companies: companies.data,
      deals: deals.data,
    },
    query: q,
  });
}
