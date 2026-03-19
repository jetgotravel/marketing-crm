import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { logActivity } from '../../../_lib/activities.js';
import { unauthorized, badRequest, notFound, dbError } from '../../../_lib/errors.js';

const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

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

  if (!body.stage) return badRequest('stage is required');
  if (!VALID_STAGES.includes(body.stage)) {
    return badRequest(`Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}`);
  }

  // Fetch current deal to get old stage
  const { data: existing, error: fetchError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (fetchError || !existing) return notFound('Deal');

  if (existing.stage === body.stage) {
    return NextResponse.json({ data: existing });
  }

  const oldStage = existing.stage;

  const { data, error } = await supabase
    .from('deals')
    .update({ stage: body.stage, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error) return dbError(error);

  await logActivity(auth.tenant_id, {
    contactId: data.contact_id,
    companyId: data.company_id,
    dealId: data.id,
    type: 'deal_stage_changed',
    metadata: { deal_name: data.deal_name, old_stage: oldStage, new_stage: body.stage },
  });

  return NextResponse.json({ data });
}
