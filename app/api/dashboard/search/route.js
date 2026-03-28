import { verifyDashboardAuth, unauthorizedResponse } from "../../../../lib/auth";
import { proxyGet } from "../../../../lib/proxy";

export async function GET(request) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const data = await proxyGet("/search", searchParams, api_key);
  return Response.json(data);
}
