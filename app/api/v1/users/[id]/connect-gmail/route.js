import { NextResponse } from 'next/server';
import { authenticate } from '../../../_lib/auth.js';
import supabase from '../../../_lib/db.js';
import { getTenantGoogleCredentials, getAuthUrl, REDIRECT_URI } from '../../../_lib/google-oauth.js';
import { unauthorized, notFound, badRequest } from '../../../_lib/errors.js';

export async function POST(req, { params }) {
  const auth = await authenticate(req);
  if (auth.error) return unauthorized(auth.error);

  const { id } = await params;

  // Verify user belongs to tenant
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', auth.tenant_id)
    .single();

  if (!user) return notFound('User');

  // Get tenant's Google OAuth credentials
  let credentials;
  try {
    credentials = await getTenantGoogleCredentials(auth.tenant_id);
  } catch (err) {
    return badRequest(err.message);
  }

  // Encode user_id and tenant_id in state
  const state = Buffer.from(JSON.stringify({
    user_id: id,
    tenant_id: auth.tenant_id,
  })).toString('base64url');

  const authUrl = getAuthUrl(credentials.clientId, REDIRECT_URI, state);

  return NextResponse.json({ data: { auth_url: authUrl, redirect_uri: REDIRECT_URI } });
}
