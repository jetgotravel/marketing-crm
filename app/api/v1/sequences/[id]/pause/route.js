import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, badRequest, errorResponse } from '../../../_lib/errors.js';

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

  if (!body.contact_id) return badRequest('contact_id is required');

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  const { data, error } = await supabase
    .from('sequence_enrollments')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('sequence_id', id)
    .eq('contact_id', body.contact_id)
    .eq('status', 'active')
    .select()
    .single();

  if (error || !data) return notFound('Active enrollment');

  return NextResponse.json({ data });
}
