import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function verifyDashboardAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_dash_session");

  if (!session || session.value !== "authenticated") {
    return { authorized: false };
  }

  return { authorized: true };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
