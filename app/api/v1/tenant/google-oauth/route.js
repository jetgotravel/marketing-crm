import { NextResponse } from 'next/server';
import { authenticate } from '../../_lib/auth.js';
import supabase from '../../_lib/db.js';
import { unauthorized, badRequest, dbError } from '../../_lib/errors.js';

/**
 * GET - Check if tenant has Google OAuth configured
 */
export async function GET(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { data, error } = await supabase
    .from('tenants')
    .select('google_client_id')
    .eq('id', auth.tenant_id)
    .single();

  if (error) return dbError(error);

  return NextResponse.json({
    data: {
      configured: !!data.google_client_id,
      client_id: data.google_client_id ? `${data.google_client_id.slice(0, 12)}...` : null,
    },
  });
}

/**
 * POST - Set the tenant's Google OAuth client_id and client_secret
 * Each tenant sets up their own Google Cloud project with internal access type.
 */
export async function POST(req) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.google_client_id) return badRequest('google_client_id is required');
  if (!body.google_client_secret) return badRequest('google_client_secret is required');

  const { data, error } = await supabase
    .from('tenants')
    .update({
      google_client_id: body.google_client_id.trim(),
      google_client_secret: body.google_client_secret.trim(),
    })
    .eq('id', auth.tenant_id)
    .select('id, name, google_client_id')
    .single();

  if (error) return dbError(error);

  return NextResponse.json({
    data: {
      tenant_id: data.id,
      tenant_name: data.name,
      google_oauth_configured: true,
      client_id: `${data.google_client_id.slice(0, 12)}...`,
    },
  });
}
