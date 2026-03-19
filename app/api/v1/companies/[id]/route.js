import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, notFound } from '../../_lib/errors.js';
import { clampString, validateArray } from '../../_lib/validate.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (error || !data) return notFound('Company');

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

  if (body.tags && !Array.isArray(body.tags)) return badRequest('tags must be an array');

  const allowed = ['name', 'domain', 'industry', 'size_range', 'location', 'website', 'description', 'linkedin_url', 'tags', 'custom_fields'];
  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (updates.name) updates.name = clampString(updates.name, 255);
  if (updates.domain) updates.domain = clampString(updates.domain, 255);
  if (updates.industry) updates.industry = clampString(updates.industry, 100);
  if (updates.size_range) updates.size_range = clampString(updates.size_range, 50);
  if (updates.location) updates.location = clampString(updates.location, 255);
  if (updates.website) updates.website = clampString(updates.website, 500);
  if (updates.description) updates.description = clampString(updates.description, 5000);
  if (updates.linkedin_url) updates.linkedin_url = clampString(updates.linkedin_url, 500);
  if (updates.tags) updates.tags = validateArray(updates.tags, 50);

  if (Object.keys(updates).length === 0) return badRequest('No valid fields to update');

  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Company');

  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  const { data, error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .select()
    .single();

  if (error || !data) return notFound('Company');

  return NextResponse.json({ data });
}
