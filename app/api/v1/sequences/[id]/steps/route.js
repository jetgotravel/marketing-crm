import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { unauthorized, notFound, badRequest, dbError } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  const { data, error } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true })
    .order('variant_key', { ascending: true });

  if (error) return dbError(error);

  return NextResponse.json({ data });
}

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

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  // Support both single step and array (reorder)
  const steps = Array.isArray(body) ? body : (body.steps || [body]);

  // Validate steps
  for (const step of steps) {
    if (step.step_order === undefined) return badRequest('step_order is required for each step');
    if (step.step_type && !['email', 'linkedin', 'task'].includes(step.step_type)) {
      return badRequest('step_type must be email, linkedin, or task');
    }
  }

  // If this looks like a full reorder (multiple steps), replace all
  if (Array.isArray(body) || body.steps) {
    // Delete existing steps and re-insert
    await supabase.from('sequence_steps').delete().eq('sequence_id', id);

    const rows = steps.map(s => ({
      sequence_id: id,
      step_order: s.step_order,
      delay_days: s.delay_days ?? 0,
      step_type: s.step_type || 'email',
      subject: s.subject || null,
      body_template: s.body_template || null,
      channel: s.channel || 'email',
      variant_key: s.variant_key || 'A',
    }));

    const { data, error } = await supabase
      .from('sequence_steps')
      .insert(rows)
      .select()
      .order('step_order', { ascending: true });

    if (error) return dbError(error);

    return NextResponse.json({ data }, { status: 201 });
  }

  // Single step insert
  const step = steps[0];
  const { data, error } = await supabase
    .from('sequence_steps')
    .insert({
      sequence_id: id,
      step_order: step.step_order,
      delay_days: step.delay_days ?? 0,
      step_type: step.step_type || 'email',
      subject: step.subject || null,
      body_template: step.body_template || null,
      channel: step.channel || 'email',
      variant_key: step.variant_key || 'A',
    })
    .select()
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get('step_id');

  if (!stepId) return badRequest('step_id query parameter is required');

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  const { data, error } = await supabase
    .from('sequence_steps')
    .delete()
    .eq('id', stepId)
    .eq('sequence_id', id)
    .select()
    .single();

  if (error || !data) return notFound('Step');

  return NextResponse.json({ data });
}

export async function PATCH(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.step_id) return badRequest('step_id is required');

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');

  const updates = {};
  if (body.step_order !== undefined) updates.step_order = body.step_order;
  if (body.delay_days !== undefined) updates.delay_days = body.delay_days;
  if (body.step_type !== undefined) updates.step_type = body.step_type;
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body_template !== undefined) updates.body_template = body.body_template;
  if (body.channel !== undefined) updates.channel = body.channel;
  if (body.variant_key !== undefined) updates.variant_key = body.variant_key;

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('sequence_steps')
    .update(updates)
    .eq('id', body.step_id)
    .eq('sequence_id', id)
    .select()
    .single();

  if (error || !data) return notFound('Step');

  return NextResponse.json({ data });
}
