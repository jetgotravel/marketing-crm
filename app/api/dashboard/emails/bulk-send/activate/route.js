import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { createSupabaseServer } from "../../../../../../lib/supabase-server";
import { proxyPost } from "../../../../../../lib/proxy";

export async function POST(request) {
  const { authorized, user, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const body = await request.json();

  // Require password
  if (!body.password) {
    return Response.json({ error: "Password required to send emails" }, { status: 400 });
  }

  const authSupabase = await createSupabaseServer();
  const { error: authError } = await authSupabase.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });

  if (authError) {
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Process the direct sends via the send-queue process endpoint
  // Mark them as ready and let the cron pick them up, or process inline
  const { password: _, ...rest } = body;
  const data = await proxyPost("/send-queue/process-direct", { ...rest, _dashboard_confirmed: true }, api_key);
  return Response.json(data);
}
