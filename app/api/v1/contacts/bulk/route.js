import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { logActivity } from '../../_lib/activities.js';
import { unauthorized, badRequest, errorResponse } from '../../_lib/errors.js';

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

  const rows = contacts
    .filter((c) => c.email)
    .map((c) => ({
      tenant_id: auth.tenant_id,
      email: c.email.toLowerCase().trim(),
      first_name: c.first_name || null,
      last_name: c.last_name || null,
      company: c.company || null,
      title: c.title || null,
      phone: c.phone || null,
      linkedin_url: c.linkedin_url || null,
      source: c.source || 'imported',
      tags: c.tags || [],
      custom_fields: c.custom_fields || {},
      score: c.score || 0,
    }));

  if (rows.length === 0) return badRequest('No valid contacts (email required)');

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'tenant_id,email', ignoreDuplicates: true })
    .select();

  if (error) return errorResponse(error.message);

  const created = data.length;
  const skipped = rows.length - created;

  // Log activity for each created contact
  for (const contact of data) {
    await logActivity(auth.tenant_id, {
      contactId: contact.id,
      type: 'contact_created',
      metadata: { email: contact.email, source: contact.source, bulk: true },
    });
  }

  return NextResponse.json({
    data: {
      created,
      skipped,
      total_submitted: contacts.length,
      invalid: contacts.length - rows.length,
      contacts: data,
    },
  }, { status: 201 });
}
