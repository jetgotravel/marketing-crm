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
    body = {};
  }

  // Only dashboard can activate — requires _dashboard_confirmed flag
  if (!body._dashboard_confirmed) {
    return badRequest('Enrollments can only be activated from the CRM dashboard. This protects against accidental sends.');
  }

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get first step delay (minimum 1 day)
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('step_order, delay_days')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true })
    .limit(1);

  const effectiveDelay = Math.max((steps?.[0]?.delay_days || 0), 1);
  const nextStepAt = new Date(Date.now() + effectiveDelay * 24 * 60 * 60 * 1000).toISOString();

  // Build the query — activate specific enrollments or all pending
  let query = supabase
    .from('sequence_enrollments')
    .update({ status: 'active', next_step_at: nextStepAt })
    .eq('sequence_id', id)
    .eq('status', 'pending_review');

  if (body.enrollment_ids && Array.isArray(body.enrollment_ids)) {
    // Activate specific enrollments
    query = query.in('id', body.enrollment_ids);
  } else if (body.contact_ids && Array.isArray(body.contact_ids)) {
    // Activate by contact IDs
    query = query.in('contact_id', body.contact_ids);
  }
  // else: activate ALL pending_review enrollments for this sequence

  const { data, error } = await query.select();

  if (error) return dbError(error);

  return NextResponse.json({
    data: {
      activated: data.length,
      sequence_id: id,
      next_step_at: nextStepAt,
      message: `${data.length} enrollment(s) activated. First email will send after ${effectiveDelay} day(s).`,
      enrollments: data,
    },
  });
}
