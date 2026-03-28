import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, badRequest, dbError } from '../../../_lib/errors.js';

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

  if (!body.step_order) return badRequest('step_order is required');
  if (!body.variant_key) return badRequest('variant_key is required');

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get all variants at this step_order
  const { data: variants } = await supabase
    .from('sequence_steps')
    .select('id, variant_key')
    .eq('sequence_id', id)
    .eq('step_order', body.step_order);

  if (!variants || variants.length === 0) return notFound('Step');

  const winner = variants.find(v => v.variant_key === body.variant_key);
  if (!winner) return badRequest(`Variant ${body.variant_key} not found at step_order ${body.step_order}`);

  const losers = variants.filter(v => v.variant_key !== body.variant_key);

  // Delete losing variants
  if (losers.length > 0) {
    const { error } = await supabase
      .from('sequence_steps')
      .delete()
      .in('id', losers.map(l => l.id));

    if (error) return dbError(error);
  }

  // Set winner to 100% split
  await supabase
    .from('sequence_steps')
    .update({ split_ratio: 100 })
    .eq('id', winner.id);

  return NextResponse.json({
    data: {
      promoted: body.variant_key,
      step_order: body.step_order,
      removed_variants: losers.map(l => l.variant_key),
    },
  });
}
