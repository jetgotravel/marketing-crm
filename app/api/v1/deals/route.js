import { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth.js';
import supabase from '../_lib/db.js';
import { logActivity } from '../_lib/activities.js';
import { unauthorized, badRequest, dbError } from '../_lib/errors.js';
import { clampString, isValidNumber, isValidEnum, isValidDate, ENUMS } from '../_lib/validate.js';

export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const stage = searchParams.get('stage');
  const contactId = searchParams.get('contact_id');
  const companyId = searchParams.get('company_id');

  let query = supabase
    .from('deals')
    .select('*', { count: 'exact' })
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) query = query.eq('stage', stage);
  if (contactId) query = query.eq('contact_id', contactId);
  if (companyId) query = query.eq('company_id', companyId);

  const { data, error, count } = await query;

  if (error) return dbError(error);

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      total_pages: Math.ceil(count / limit),
    },
  });
}

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.deal_name) return badRequest('deal_name is required');
  if (body.value !== undefined && (!isValidNumber(body.value) || body.value < 0)) {
    return badRequest('value must be a non-negative number');
  }
  if (body.stage && !isValidEnum(body.stage, ENUMS.DEAL_STAGES)) {
    return badRequest(`Invalid stage. Must be one of: ${ENUMS.DEAL_STAGES.join(', ')}`);
  }
  if (body.expected_close_date && !isValidDate(body.expected_close_date)) {
    return badRequest('Invalid expected_close_date format');
  }

  const { data, error } = await supabase
    .from('deals')
    .insert({
      tenant_id: auth.tenant_id,
      contact_id: body.contact_id || null,
      company_id: body.company_id || null,
      deal_name: clampString(body.deal_name, 255),
      value: body.value || 0,
      stage: body.stage || 'lead',
      expected_close_date: body.expected_close_date || null,
      notes: clampString(body.notes, 5000) || null,
    })
    .select()
    .single();

  if (error) return dbError(error);

  await logActivity(auth.tenant_id, {
    contactId: body.contact_id,
    companyId: body.company_id,
    dealId: data.id,
    type: 'deal_created',
    metadata: { deal_name: data.deal_name, value: data.value, stage: data.stage },
  });

  return NextResponse.json({ data }, { status: 201 });
}
