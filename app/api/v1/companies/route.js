import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { logActivity } from '../_lib/activities.js';
import { unauthorized, badRequest, conflict, dbError } from '../_lib/errors.js';
import { escapeIlike, clampString, validateArray } from '../_lib/validate.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const q = searchParams.get('q');

  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const sq = escapeIlike(q);
    query = query.or(`name.ilike.%${sq}%,domain.ilike.%${sq}%`);
  }

  const { data, error, count } = await query;

  if (error) return dbError(error);

  // Get contact counts per company
  const companyIds = (data || []).map(c => c.id);
  let contactCounts = {};
  if (companyIds.length > 0) {
    const { data: counts } = await supabase
      .from('contacts')
      .select('company_id')
      .eq('tenant_id', auth.tenant_id)
      .in('company_id', companyIds);
    if (counts) {
      for (const row of counts) {
        contactCounts[row.company_id] = (contactCounts[row.company_id] || 0) + 1;
      }
    }
  }

  const enriched = (data || []).map(company => ({
    ...company,
    contact_count: contactCounts[company.id] || 0,
  }));

  return NextResponse.json({
    data: enriched,
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

  const tags = body.tags ? validateArray(body.tags, 50) : [];
  if (body.tags && tags === null) return badRequest('tags must be an array (max 50)');

  const { data, error } = await supabase
    .from('companies')
    .insert({
      tenant_id: auth.tenant_id,
      name: clampString(body.name, 255),
      domain: clampString(body.domain, 255) || null,
      primary_email: body.primary_email ? body.primary_email.toLowerCase().trim() : null,
      industry: clampString(body.industry, 100) || null,
      size_range: clampString(body.size_range, 50) || null,
      location: clampString(body.location, 255) || null,
      website: clampString(body.website, 500) || null,
      description: clampString(body.description, 5000) || null,
      linkedin_url: clampString(body.linkedin_url, 500) || null,
      tags,
      custom_fields: body.custom_fields || {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return conflict('Company with this domain already exists for this tenant');
    return dbError(error);
  }

  await logActivity(auth.tenant_id, {
    companyId: data.id,
    type: 'company_created',
    metadata: { name: data.name, domain: data.domain },
  });

  return NextResponse.json({ data }, { status: 201 });
}
