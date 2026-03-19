import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import { evaluateFilterRules } from '../../_lib/filter-engine.js';
import { unauthorized, badRequest, errorResponse } from '../../_lib/errors.js';

export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.filter_rules || !Array.isArray(body.filter_rules.conditions)) {
    return badRequest('filter_rules with conditions array is required');
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const result = await evaluateFilterRules(auth.tenant_id, body.filter_rules, { page, limit });

  if (result.error) return errorResponse(result.error.message);

  return NextResponse.json({
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.count,
      total_pages: Math.ceil(result.count / limit),
    },
  });
}
