import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, name, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Get all steps
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, step_order, step_type, subject, variant_key')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true });

  // Get all enrollments
  const { data: enrollments } = await supabase
    .from('sequence_enrollments')
    .select('current_step_order, status')
    .eq('sequence_id', id);

  // Get step-sent activities for this sequence
  const { data: stepActivities } = await supabase
    .from('activities')
    .select('metadata')
    .eq('tenant_id', auth.tenant_id)
    .eq('activity_type', 'sequence_step_sent')
    .filter('metadata->>sequence_id', 'eq', id);

  // Build per-step stats
  const stepStats = steps.map(step => {
    const atOrPast = enrollments.filter(e =>
      e.current_step_order >= step.step_order || e.status === 'completed'
    ).length;
    const sent = (stepActivities || []).filter(a =>
      a.metadata.step_order === step.step_order && a.metadata.variant_key === step.variant_key
    ).length;
    const replied = enrollments.filter(e => e.status === 'replied').length;

    return {
      step_order: step.step_order,
      step_type: step.step_type,
      subject: step.subject,
      variant_key: step.variant_key,
      sent,
      reached: atOrPast,
      replied,
    };
  });

  // Overall stats
  const total = enrollments.length;
  const active = enrollments.filter(e => e.status === 'active').length;
  const paused = enrollments.filter(e => e.status === 'paused').length;
  const completed = enrollments.filter(e => e.status === 'completed').length;
  const replied = enrollments.filter(e => e.status === 'replied').length;

  return NextResponse.json({
    data: {
      sequence_id: id,
      sequence_name: sequence.name,
      sequence_status: sequence.status,
      overall: { total, active, paused, completed, replied },
      steps: stepStats,
    },
  });
}
