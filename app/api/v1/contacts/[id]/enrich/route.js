import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { logActivity } from '../../../_lib/activities.js';
import { unauthorized, badRequest, notFound, errorResponse } from '../../../_lib/errors.js';

export async function POST(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.enrichment_data || typeof body.enrichment_data !== 'object') {
    return badRequest('enrichment_data object is required');
  }

  // Fetch existing contact
  const { data: existing, error: fetchError } = await supabase
    .from('contacts')
    .select('enrichment_data')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (fetchError || !existing) return notFound('Contact');

  // Merge enrichment data (new fields override existing)
  const merged = { ...existing.enrichment_data, ...body.enrichment_data };

  const { data, error } = await supabase
    .from('contacts')
    .update({ enrichment_data: merged })
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return errorResponse(error.message);

  await logActivity(auth.tenant_id, {
    contactId: id,
    type: 'enriched',
    metadata: { fields_added: Object.keys(body.enrichment_data) },
  });

  return NextResponse.json({ data });
}
