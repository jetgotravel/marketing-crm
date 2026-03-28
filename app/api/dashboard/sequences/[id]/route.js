import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../lib/auth";
import { createSupabaseServer } from "../../../../../lib/supabase-server";
import { proxyGet, proxyPatch } from "../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const data = await proxyGet(`/sequences/${id}`, null, api_key);
  return Response.json(data);
}

export async function PATCH(request, { params }) {
  const { authorized, api_key, user } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();

  // If activating, require password confirmation
  if (body.status === 'active') {
    if (!body.password) {
      return Response.json({ error: "Password required to activate a sequence" }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: body.password,
    });

    if (authError) {
      return Response.json({ error: "Incorrect password" }, { status: 401 });
    }
  }

  const { password: _, ...rest } = body;
  const payload = body.status === 'active' ? { ...rest, _dashboard_confirmed: true } : rest;
  const data = await proxyPatch(`/sequences/${id}`, payload, api_key);
  return Response.json(data);
}
