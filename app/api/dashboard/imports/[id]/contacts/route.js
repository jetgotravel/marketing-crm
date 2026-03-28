import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { proxyGet } from "../../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const data = await proxyGet(`/imports/${id}/contacts`, searchParams, api_key);
  return Response.json(data);
}
