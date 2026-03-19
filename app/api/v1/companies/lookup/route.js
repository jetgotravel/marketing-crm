import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
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

  if (!body.domain) return badRequest('domain is required');

  const domain = body.domain.toLowerCase().trim();

  // Try to find existing company by domain
  const { data: existing } = await supabase
    .from('companies')
    .select('*')
    .eq('tenant_id', auth.tenant_id)
    .eq('domain', domain)
    .single();

  let company = existing;
  let created = false;

  if (!company) {
    // Create new company
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        tenant_id: auth.tenant_id,
        name: body.name || domain,
        domain,
        industry: body.industry || null,
        size_range: body.size_range || null,
        location: body.location || null,
        website: body.website || null,
        description: body.description || null,
        linkedin_url: body.linkedin_url || null,
        tags: body.tags || [],
        custom_fields: body.custom_fields || {},
      })
      .select()
      .single();

    if (error) return dbError(error);

    company = newCompany;
    created = true;

    await logActivity(auth.tenant_id, {
      companyId: company.id,
      type: 'company_created',
      metadata: { name: company.name, domain: company.domain, source: 'lookup' },
    });
  }

  // Link contact if contact_id provided
  if (body.contact_id) {
    // Verify contact belongs to tenant
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', body.contact_id)
      .eq('tenant_id', auth.tenant_id)
      .single();

    if (contact) {
      const { error: linkError } = await supabase
        .from('contact_companies')
        .upsert(
          { contact_id: body.contact_id, company_id: company.id },
          { onConflict: 'contact_id,company_id' }
        );

      if (linkError) console.error('Failed to link contact to company:', linkError.message);
    }
  }

  return NextResponse.json({ data: company, created }, { status: created ? 201 : 200 });
}
