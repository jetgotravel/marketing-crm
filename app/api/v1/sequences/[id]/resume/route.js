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

  if (!body.contact_id) return badRequest('contact_id is required');

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get current enrollment
  const { data: enrollment } = await supabase
    .from('sequence_enrollments')
    .select('*')
    .eq('sequence_id', id)
    .eq('contact_id', body.contact_id)
    .eq('status', 'paused')
    .single();

  if (!enrollment) return notFound('Paused enrollment');

  // Get the current step to recalculate next_step_at
  const { data: step } = await supabase
    .from('sequence_steps')
    .select('delay_days')
    .eq('sequence_id', id)
    .eq('step_order', enrollment.current_step_order)
    .limit(1)
    .single();

  const delayDays = step?.delay_days || 0;
  const nextStepAt = new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sequence_enrollments')
    .update({
      status: 'active',
      next_step_at: nextStepAt,
      updated_at: new Date().toISOString(),
    })
    .eq('sequence_id', id)
    .eq('contact_id', body.contact_id)
    .select()
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ data });
}
