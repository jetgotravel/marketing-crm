import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    const secret = process.env.DASHBOARD_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Dashboard not configured" },
        { status: 500 }
      );
    }

    // Timing-safe comparison to prevent timing attacks
    const pinBuf = Buffer.from(pin);
    const secretBuf = Buffer.from(secret);
    if (pinBuf.length !== secretBuf.length || !crypto.timingSafeEqual(pinBuf, secretBuf)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // Generate a signed session token instead of static "authenticated"
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac("sha256", secret)
      .update(timestamp)
      .digest("hex");
    const sessionToken = `${timestamp}.${signature}`;

    const response = NextResponse.json({ ok: true });
    response.cookies.set("crm_dash_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
