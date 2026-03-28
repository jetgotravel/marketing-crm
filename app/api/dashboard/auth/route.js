import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../lib/supabase-server.js";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: { email: data.user.email } });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
