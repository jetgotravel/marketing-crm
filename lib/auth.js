import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "./supabase-server.js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify dashboard auth via Supabase session.
 * Returns { authorized, user, tenant_id, api_key } or { authorized: false }.
 */
export async function verifyDashboardAuth() {
  const supabase = await createSupabaseServer();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { authorized: false };
  }

  // Look up CRM user by email
  const { data: crmUser } = await adminSupabase
    .from("users")
    .select("id, tenant_id, email, name, role")
    .eq("email", authUser.email.toLowerCase())
    .single();

  if (!crmUser) {
    return { authorized: false };
  }

  // Get the tenant's API key for proxying to v1 routes
  const { data: apiKeyRow } = await adminSupabase
    .from("api_keys")
    .select("key")
    .eq("tenant_id", crmUser.tenant_id)
    .limit(1)
    .single();

  return {
    authorized: true,
    user: crmUser,
    tenant_id: crmUser.tenant_id,
    api_key: apiKeyRow?.key || null,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
