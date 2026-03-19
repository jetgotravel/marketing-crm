import { verifyDashboardAuth, unauthorizedResponse } from "../../../../lib/auth";
import { proxyGet } from "../../../../lib/proxy";

export async function GET(request) {
  const { authorized } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const data = await proxyGet("/contacts", searchParams);
  return Response.json(data);
}
