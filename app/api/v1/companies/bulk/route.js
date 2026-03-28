import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, dbError } from '../../_lib/errors.js';
import { clampString, isValidEmail, validateArray } from '../../_lib/validate.js';

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { companies } = body;
  if (!Array.isArray(companies) || companies.length === 0) {
    return badRequest('companies must be a non-empty array');
  }
  if (companies.length > 500) {
    return badRequest('Maximum 500 companies per bulk import');
  }

  // Create or reuse import batch
  let batchId = body.import_batch_id || null;
  if (!batchId) {
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        tenant_id: auth.tenant_id,
        name: body.batch_name || null,
        source: body.batch_source || 'api',
        tags: body.batch_tags || [],
        metadata: body.batch_metadata || {},
      })
      .select()
      .single();
    if (batchErr) return dbError(batchErr);
    batchId = batch.id;
  }

  const rows = companies
    .filter((c) => c.name)
    .map((c) => ({
      tenant_id: auth.tenant_id,
      import_batch_id: batchId,
      name: clampString(c.name, 255),
      domain: c.domain ? clampString(c.domain.toLowerCase().trim(), 255) : null,
      primary_email: c.primary_email && isValidEmail(c.primary_email) ? c.primary_email.toLowerCase().trim() : null,
      industry: clampString(c.industry, 100) || null,
      size_range: clampString(c.size_range, 50) || null,
      location: clampString(c.location, 255) || null,
      website: clampString(c.website, 500) || null,
      description: clampString(c.description, 5000) || null,
      linkedin_url: clampString(c.linkedin_url, 500) || null,
      tags: validateArray(c.tags, 50) || [],
      custom_fields: c.custom_fields || {},
    }));

  if (rows.length === 0) return badRequest('No valid companies (name required)');

  // Upsert on tenant_id+domain for companies that have domains
  const withDomain = rows.filter((r) => r.domain);
  const withoutDomain = rows.filter((r) => !r.domain);

  let allResults = [];

  if (withDomain.length > 0) {
    const { data, error } = await supabase
      .from('companies')
      .upsert(withDomain, { onConflict: 'tenant_id,domain', ignoreDuplicates: true })
      .select();
    if (error) return dbError(error);
    allResults.push(...(data || []));
  }

  if (withoutDomain.length > 0) {
    const { data, error } = await supabase
      .from('companies')
      .insert(withoutDomain)
      .select();
    if (error) return dbError(error);
    allResults.push(...(data || []));
  }

  // Log activities
  for (const company of allResults) {
    await logActivity(auth.tenant_id, {
      companyId: company.id,
      type: 'company_created',
      metadata: { name: company.name, domain: company.domain, bulk: true },
    });
  }

  // Update batch company count
  await supabase
    .from('import_batches')
    .update({ company_count: allResults.length })
    .eq('id', batchId);

  return NextResponse.json({
    data: {
      import_batch_id: batchId,
      created: allResults.length,
      total_submitted: companies.length,
      invalid: companies.length - rows.length,
      companies: allResults,
    },
  }, { status: 201 });
}
