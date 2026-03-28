import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../lib/auth";
import { proxyGet } from "../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const data = await proxyGet(`/companies/${id}`, null, api_key);
  return Response.json(data);
}
