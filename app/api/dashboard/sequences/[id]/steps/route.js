import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { proxyGet } from "../../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const data = await proxyGet(`/sequences/${id}/steps`);
  return Response.json(data);
}
