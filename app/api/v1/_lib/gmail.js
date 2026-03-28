import supabase from './db.js';
import { getTenantGoogleCredentials, refreshAccessToken } from './google-oauth.js';

/**
 * Build a raw MIME message for Gmail API.
 */
function buildMimeMessage({ from, to, subject, htmlBody }) {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
    `--${boundary}--`,
  ];
  return lines.join('\r\n');
}

/**
 * Send an email via a user's connected Gmail.
 * Looks up the tenant's Google OAuth credentials automatically.
 * Returns { messageId, threadId } on success.
 */
export async function sendGmail(userId, { to, subject, htmlBody }) {
  // Get user's refresh token and tenant_id
  const { data: user, error } = await supabase
    .from('users')
    .select('email, tenant_id, google_refresh_token, gmail_connected')
    .eq('id', userId)
    .single();

  if (error || !user) throw new Error('User not found');
  if (!user.gmail_connected || !user.google_refresh_token) {
    throw new Error('User has not connected Gmail');
  }

  // Get tenant's Google OAuth credentials
  const { clientId, clientSecret } = await getTenantGoogleCredentials(user.tenant_id);

  // Get fresh access token using tenant's credentials
  const accessToken = await refreshAccessToken(user.google_refresh_token, clientId, clientSecret);

  // Build and encode the message
  const raw = buildMimeMessage({ from: user.email, to, subject, htmlBody });
  const encodedMessage = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send via Gmail API
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(`Gmail send failed: ${result.error?.message || JSON.stringify(result)}`);
  }

  return {
    messageId: result.id,
    threadId: result.threadId,
  };
}
