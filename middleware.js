import { NextResponse } from "next/server";
import crypto from "crypto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function verifySessionToken(value) {
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

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip auth check for these paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/dashboard/auth") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("crm_dash_session");

  if (!session || !verifySessionToken(session.value)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
