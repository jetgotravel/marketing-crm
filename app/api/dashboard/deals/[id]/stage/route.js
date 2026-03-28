import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { proxyPatch } from "../../../../../../lib/proxy";

export async function PATCH(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const data = await proxyPatch(`/deals/${id}/stage`, body, api_key);
  return Response.json(data);
}
