import crypto from "crypto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Verify a signed session token ("timestamp.hmac") against DASHBOARD_SECRET.
 * Shared by middleware.js and lib/auth.js to avoid duplicating HMAC logic.
 */
export function verifySessionToken(value) {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret || !value) return false;

  const parts = value.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > THIRTY_DAYS_MS) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  return true;
}
