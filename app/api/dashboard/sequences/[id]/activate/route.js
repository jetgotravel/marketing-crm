import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { createSupabaseServer } from "../../../../../../lib/supabase-server";
import { proxyPost } from "../../../../../../lib/proxy";

export async function POST(request, { params }) {
  const { authorized, api_key, user } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();

  // Require password confirmation
  if (!body.password) {
    return Response.json({ error: "Password required to activate enrollments" }, { status: 400 });
  }

  // Verify password via Supabase Auth
  const supabase = await createSupabaseServer();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });

  if (authError) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Password confirmed — activate with dashboard flag
  const { password: _, ...rest } = body;
  const data = await proxyPost(`/sequences/${id}/activate`, { ...rest, _dashboard_confirmed: true }, api_key);
  return Response.json(data);
}
