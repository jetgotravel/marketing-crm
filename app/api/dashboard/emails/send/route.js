import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../lib/auth";
import { proxyPost } from "../../../../../lib/proxy";

export async function POST(request) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const body = await request.json();
  const data = await proxyPost("/emails/send", body, api_key);
  return Response.json(data);
}
