import supabase from './db.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

/** Fixed callback URL registered in each tenant's Google Console */
export const REDIRECT_URI = 'https://marketing-crm-ten.vercel.app/api/v1/auth/gmail-callback';

/**
 * Fetch the tenant's Google OAuth credentials from the tenants table.
 */
export async function getTenantGoogleCredentials(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('google_client_id, google_client_secret')
    .eq('id', tenantId)
    .single();

  if (error || !data) throw new Error('Tenant not found');
  if (!data.google_client_id || !data.google_client_secret) {
    throw new Error('Tenant has not configured Google OAuth credentials. Set google_client_id and google_client_secret on the tenant.');
  }

  return { clientId: data.google_client_id, clientSecret: data.google_client_secret };
}

export function getAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  return res.json();
}

export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data.access_token;
}
