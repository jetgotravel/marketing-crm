import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function verifyDashboardAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_dash_session");

  if (!session || !session.value) {
    return { authorized: false };
  }

  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return { authorized: false };
  }

  // Validate signed session token: "timestamp.hmac"
  const parts = session.value.split(".");
  if (parts.length !== 2) {
    return { authorized: false };
  }

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { authorized: false };
  }

  // Check token age (30 days max)
  if (Date.now() - ts > THIRTY_DAYS_MS) {
    return { authorized: false };
  }

  // Verify HMAC signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { authorized: false };
  }

  return { authorized: true };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
