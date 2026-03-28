import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { logActivity } from '../../../_lib/activities.js';
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

  // Verify sequence ownership and status
  const { data: sequence } = await supabase
    .from('sequences')
    .select('id, status, cooldown_days')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!sequence) return notFound('Sequence');
  if (sequence.status !== 'active') {
    return badRequest('Sequence must be active to enroll contacts');
  }

  // Get first step delay to calculate next_step_at
  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('step_order, delay_days')
    .eq('sequence_id', id)
    .order('step_order', { ascending: true });

  if (!steps || steps.length === 0) {
    return badRequest('Sequence has no steps');
  }

  const firstStepOrder = steps[0].step_order;
  const firstDelay = steps[0].delay_days || 0;

  // Resolve contact IDs
  let contactIds = [];

  if (body.list_id) {
    // Verify list belongs to this tenant before reading contacts
    const { data: list } = await supabase
      .from('lists')
      .select('id')
      .eq('id', body.list_id)
      .eq('tenant_id', auth.tenant_id)
      .single();

    if (!list) return badRequest('List not found or does not belong to this tenant');

    const { data: listContacts } = await supabase
      .from('list_contacts')
      .select('contact_id')
      .eq('list_id', body.list_id);

    if (!listContacts || listContacts.length === 0) {
      return badRequest('List has no contacts');
    }
    contactIds = listContacts.map(lc => lc.contact_id);
  } else if (body.contact_ids) {
    if (!Array.isArray(body.contact_ids)) return badRequest('contact_ids must be an array');
    if (body.contact_ids.length > 500) return badRequest('Maximum 500 contacts per enrollment');
    contactIds = body.contact_ids;
  } else if (body.contact_id) {
    contactIds = [body.contact_id];
  } else {
    return badRequest('Provide contact_id, contact_ids, or list_id');
  }

  // Validate sender_user_id if provided
  const senderUserId = body.sender_user_id || null;
  if (senderUserId) {
    const { data: sender } = await supabase
      .from('users')
      .select('id, gmail_connected')
      .eq('id', senderUserId)
      .eq('tenant_id', auth.tenant_id)
      .single();
    if (!sender) return badRequest('sender_user_id not found for this tenant');
  }

  // Cooldown check: skip contacts enrolled in this sequence recently
  let filteredContactIds = contactIds;
  const cooldownDays = sequence.cooldown_days || 0;
  if (cooldownDays > 0) {
    const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentEnrollments } = await supabase
      .from('sequence_enrollments')
      .select('contact_id')
      .eq('sequence_id', id)
      .gte('enrolled_at', cooldownDate);
    if (recentEnrollments && recentEnrollments.length > 0) {
      const recentIds = new Set(recentEnrollments.map(e => e.contact_id));
      filteredContactIds = contactIds.filter(cid => !recentIds.has(cid));
    }
  }

  if (filteredContactIds.length === 0) {
    return badRequest('All contacts are within the cooldown period for this sequence');
  }

  // All enrollments start as pending_review — activation requires dashboard confirmation
  const skipReview = body.skip_review === true && body._dashboard_confirmed === true;
  const initialStatus = skipReview ? 'active' : 'pending_review';

  // Enforce minimum 1-day delay on first step for safety
  const effectiveDelay = Math.max(firstDelay, 1);
  const nextStepAt = skipReview
    ? new Date(Date.now() + effectiveDelay * 24 * 60 * 60 * 1000).toISOString()
    : null; // pending_review enrollments don't have a next_step_at until activated

  // Build enrollment rows
  const rows = filteredContactIds.map(contactId => ({
    sequence_id: id,
    contact_id: contactId,
    current_step_order: firstStepOrder,
    status: initialStatus,
    next_step_at: nextStepAt,
    sender_user_id: senderUserId,
  }));

  // Upsert to avoid duplicate enrollment errors
  const { data, error } = await supabase
    .from('sequence_enrollments')
    .upsert(rows, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })
    .select();

  if (error) return dbError(error);

  // Log activity for each enrolled contact
  const activityPromises = contactIds.map(contactId =>
    logActivity(auth.tenant_id, {
      contactId,
      type: 'sequence_enrolled',
      metadata: { sequence_id: id, sequence_name: sequence.name },
    })
  );
  await Promise.all(activityPromises);

  return NextResponse.json({
    data: {
      enrolled: data.length,
      sequence_id: id,
      status: initialStatus,
      message: initialStatus === 'pending_review'
        ? 'Contacts enrolled as pending_review. Call activate_enrollments to start sending.'
        : 'Contacts enrolled and active. First email will send after minimum 24hr delay.',
      enrollments: data,
    },
  }, { status: 201 });
}
