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

  const rows = contacts
    .filter((c) => c.email && isValidEmail(c.email))
    .map((c) => ({
      tenant_id: auth.tenant_id,
      email: c.email.toLowerCase().trim(),
      first_name: clampString(c.first_name, 255) || null,
      last_name: clampString(c.last_name, 255) || null,
      company: clampString(c.company, 255) || null,
      title: clampString(c.title, 255) || null,
      phone: clampString(c.phone, 50) || null,
      linkedin_url: clampString(c.linkedin_url, 500) || null,
      source: c.source || 'imported',
      tags: validateArray(c.tags, 100) || [],
      custom_fields: c.custom_fields || {},
      score: isValidNumber(c.score) ? Math.max(0, Math.min(1000, c.score)) : 0,
    }));

  if (rows.length === 0) return badRequest('No valid contacts (email required)');

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'tenant_id,email', ignoreDuplicates: true })
    .select();

  if (error) return dbError(error);

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
