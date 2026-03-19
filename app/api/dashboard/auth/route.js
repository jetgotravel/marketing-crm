import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    const secret = process.env.DASHBOARD_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Dashboard not configured" },
        { status: 500 }
      );
    }

    if (pin !== secret) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set("crm_dash_session", "authenticated", {
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
