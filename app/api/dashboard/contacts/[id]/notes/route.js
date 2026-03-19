import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { proxyGet } from "../../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const data = await proxyGet(`/contacts/${id}/notes`, searchParams);
  return Response.json(data);
}
