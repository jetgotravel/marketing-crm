import { NextResponse } from 'next/server';
import supabase from '../../_lib/db.js';
import { getTenantGoogleCredentials, exchangeCode, REDIRECT_URI } from '../../_lib/google-oauth.js';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: `OAuth denied: ${error}` }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing authorization code or state' }, { status: 400 });
  }

  // Decode state to get user_id and tenant_id
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
  }

  const { user_id, tenant_id } = stateData;
  if (!user_id || !tenant_id) {
    return NextResponse.json({ error: 'Missing user_id or tenant_id in state' }, { status: 400 });
  }

  // Verify user exists and belongs to tenant
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', user_id)
    .eq('tenant_id', tenant_id)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 400 });
  }

  // Get tenant's Google OAuth credentials
  let credentials;
  try {
    credentials = await getTenantGoogleCredentials(tenant_id);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Exchange code for tokens
  const tokens = await exchangeCode(code, REDIRECT_URI, credentials.clientId, credentials.clientSecret);

  if (tokens.error) {
    return NextResponse.json({ error: `Token exchange failed: ${tokens.error_description || tokens.error}` }, { status: 400 });
  }

  if (!tokens.refresh_token) {
    return NextResponse.json({ error: 'No refresh token received. User may need to revoke access and reconnect.' }, { status: 400 });
  }

  // Store refresh token and mark gmail as connected
  const { error: updateError } = await supabase
    .from('users')
    .update({
      google_refresh_token: tokens.refresh_token,
      gmail_connected: true,
    })
    .eq('id', user_id)
    .eq('tenant_id', tenant_id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save Gmail connection' }, { status: 500 });
  }

  return new NextResponse(
    '<html><body><h2>Gmail connected successfully</h2><p>You can close this window.</p></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}
