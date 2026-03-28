import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, notFound, badRequest, dbError } from '../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('sequences')
    .select('*, sequence_steps(*)')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Sequence');

  // Sort steps by step_order
  if (data.sequence_steps) {
    data.sequence_steps.sort((a, b) => a.step_order - b.step_order || a.variant_key.localeCompare(b.variant_key));
  }

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

  // Verify ownership
  const { data: existing } = await supabase
    .from('sequences')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!existing) return notFound('Sequence');

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) {
    if (!['draft', 'active', 'paused', 'completed'].includes(body.status)) {
      return badRequest('Invalid status');
    }
    // Activating a sequence requires dashboard confirmation — block from API
    if (body.status === 'active' && existing.status !== 'active' && !body._dashboard_confirmed) {
      return badRequest('Sequences can only be activated from the CRM dashboard. This protects against accidental sends.');
    }
    updates.status = body.status;
  }
  if (body.send_window_start !== undefined) updates.send_window_start = body.send_window_start;
  if (body.send_window_end !== undefined) updates.send_window_end = body.send_window_end;
  if (body.skip_weekends !== undefined) updates.skip_weekends = body.skip_weekends;
  if (body.daily_send_limit !== undefined) updates.daily_send_limit = body.daily_send_limit;
  if (body.cooldown_days !== undefined) updates.cooldown_days = body.cooldown_days;

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('sequences')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return dbError(error);

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('sequences')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Sequence');

  return NextResponse.json({ data });
}
