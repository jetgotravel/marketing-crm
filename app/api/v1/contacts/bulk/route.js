import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, dbError } from '../../_lib/errors.js';
import { isValidEmail, clampString, isValidNumber, validateArray } from '../../_lib/validate.js';

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { contacts } = body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return badRequest('contacts must be a non-empty array');
  }

  if (contacts.length > 1000) {
    return badRequest('Maximum 1000 contacts per bulk import');
  }

  // Create an import batch
  const batchName = body.batch_name || null;
  const batchTags = body.batch_tags || [];
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      tenant_id: auth.tenant_id,
      name: batchName,
      source: body.batch_source || 'api',
      tags: batchTags,
      metadata: body.batch_metadata || {},
    })
    .select()
    .single();

  if (batchErr) return dbError(batchErr);

  // Collect unique company domains for auto-linking
  const companyDomains = new Map();
  for (const c of contacts) {
    if (c.company_domain) {
      const domain = c.company_domain.toLowerCase().trim();
      if (!companyDomains.has(domain)) {
        companyDomains.set(domain, { name: c.company_name || c.company || domain, domain });
      }
    }
  }

  // Upsert companies if any domains provided
  const domainToId = new Map();
  if (companyDomains.size > 0) {
    const companyRows = [...companyDomains.values()].map((c) => ({
      tenant_id: auth.tenant_id,
      name: clampString(c.name, 255),
      domain: c.domain,
    }));
    const { data: companyData } = await supabase
      .from('companies')
      .upsert(companyRows, { onConflict: 'tenant_id,domain', ignoreDuplicates: true })
      .select('id, domain');

    // Also fetch existing companies for domains that were skipped
    if (companyData) {
      for (const co of companyData) domainToId.set(co.domain, co.id);
    }
    // Fetch any existing ones we didn't create
    const missingDomains = [...companyDomains.keys()].filter((d) => !domainToId.has(d));
    if (missingDomains.length > 0) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id, domain')
        .eq('tenant_id', auth.tenant_id)
        .in('domain', missingDomains);
      if (existing) {
        for (const co of existing) domainToId.set(co.domain, co.id);
      }
    }
  }

  const rows = contacts
    .filter((c) => c.email && isValidEmail(c.email))
    .map((c) => {
      const companyId = c.company_domain ? domainToId.get(c.company_domain.toLowerCase().trim()) : (c.company_id || null);
      return {
        tenant_id: auth.tenant_id,
        email: c.email.toLowerCase().trim(),
        first_name: clampString(c.first_name, 255) || null,
        last_name: clampString(c.last_name, 255) || null,
        company: clampString(c.company_name || c.company, 255) || null,
        title: clampString(c.title, 255) || null,
        phone: clampString(c.phone, 50) || null,
        linkedin_url: clampString(c.linkedin_url, 500) || null,
        source: c.source || 'imported',
        tags: validateArray(c.tags, 100) || [],
        custom_fields: c.custom_fields || {},
        score: isValidNumber(c.score) ? Math.max(0, Math.min(1000, c.score)) : 0,
        company_id: companyId || null,
        is_placeholder: c.is_placeholder || false,
        import_batch_id: batch.id,
        seniority: clampString(c.seniority, 100) || null,
        department: clampString(c.department, 100) || null,
        city: clampString(c.city, 255) || null,
        country: clampString(c.country, 100) || null,
        photo_url: clampString(c.photo_url, 500) || null,
        employment_history: c.employment_history || [],
      };
    });

  if (rows.length === 0) return badRequest('No valid contacts (email required)');

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'tenant_id,email', ignoreDuplicates: true })
    .select();

  if (error) return dbError(error);

  const created = data.length;
  const skipped = rows.length - created;

  // Update batch counts
  await supabase
    .from('import_batches')
    .update({ contact_count: created, company_count: domainToId.size })
    .eq('id', batch.id);

  // Log activity for each created contact
  for (const contact of data) {
    await logActivity(auth.tenant_id, {
      contactId: contact.id,
      type: 'contact_created',
      metadata: { email: contact.email, source: contact.source, bulk: true, import_batch_id: batch.id },
    });
  }

  return NextResponse.json({
    data: {
      import_batch_id: batch.id,
      batch_name: batchName,
      created,
      skipped,
      total_submitted: contacts.length,
      invalid: contacts.length - rows.length,
      companies_linked: domainToId.size,
      contacts: data,
    },
  }, { status: 201 });
}
