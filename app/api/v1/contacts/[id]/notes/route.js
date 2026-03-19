import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { logActivity } from '../../../_lib/activities.js';
import { unauthorized, badRequest, notFound, dbError } from '../../../_lib/errors.js';

export async function GET(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify contact belongs to tenant
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!contact) return notFound('Contact');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('contact_id', id)
    .eq('tenant_id', auth.tenant_id)
    .order('created_at', { ascending: false });

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

  if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
    return badRequest('content is required');
  }

  // Verify contact belongs to tenant
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!contact) return notFound('Contact');

  const { data, error } = await supabase
    .from('notes')
    .insert({
      tenant_id: auth.tenant_id,
      contact_id: id,
      content: body.content.trim(),
    })
    .select()
    .single();

  if (error) return dbError(error);

  await logActivity(auth.tenant_id, {
    contactId: id,
    type: 'note_added',
    metadata: { note_id: data.id },
  });

  return NextResponse.json({ data }, { status: 201 });
}
