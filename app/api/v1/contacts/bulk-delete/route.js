import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
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

  const { contact_ids, import_batch_id, filter } = body;

  if (!contact_ids && !import_batch_id && !filter) {
    return badRequest('Provide contact_ids array, import_batch_id, or filter object');
  }

  let query = supabase
    .from('contacts')
    .delete()
    .eq('tenant_id', auth.tenant_id);

  if (contact_ids && Array.isArray(contact_ids)) {
    if (contact_ids.length > 500) return badRequest('Maximum 500 contact IDs');
    query = query.in('id', contact_ids);
  } else if (import_batch_id) {
    query = query.eq('import_batch_id', import_batch_id);
    // Apply additional filter if provided alongside batch
    if (filter) {
      if (filter.status) query = query.eq('status', filter.status);
      if (filter.source) query = query.eq('source', filter.source);
      if (filter.missing_field) {
        query = query.is(filter.missing_field, null);
      }
    }
  } else if (filter) {
    // Filter-only delete — require at least one filter to prevent accidental delete-all
    let hasFilter = false;
    if (filter.status) { query = query.eq('status', filter.status); hasFilter = true; }
    if (filter.source) { query = query.eq('source', filter.source); hasFilter = true; }
    if (filter.missing_field) { query = query.is(filter.missing_field, null); hasFilter = true; }
    if (filter.import_batch_id) { query = query.eq('import_batch_id', filter.import_batch_id); hasFilter = true; }
    if (!hasFilter) return badRequest('Filter must include at least one condition');
  }

  const { data, error } = await query.select('id');

  if (error) return dbError(error);

  return NextResponse.json({
    data: {
      deleted: data?.length || 0,
    },
  });
}
