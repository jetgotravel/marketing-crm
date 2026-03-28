import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../lib/auth";
import { proxyGet, proxyPatch } from "../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const data = await proxyGet(`/templates/${id}`, null, api_key);
  return Response.json(data);
}

export async function PATCH(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const data = await proxyPatch(`/templates/${id}`, body, api_key);
  return Response.json(data);
}
