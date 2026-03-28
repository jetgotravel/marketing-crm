import { verifyDashboardAuth, unauthorizedResponse } from "../../../../../../lib/auth";
import { proxyGet, proxyPost, proxyPatch, proxyDelete } from "../../../../../../lib/proxy";

export async function GET(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const data = await proxyGet(`/sequences/${id}/steps`, null, api_key);
  return Response.json(data);
}

export async function POST(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const data = await proxyPost(`/sequences/${id}/steps`, body, api_key);
  return Response.json(data);
}

export async function PATCH(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const body = await request.json();
  const data = await proxyPatch(`/sequences/${id}/steps`, body, api_key);
  return Response.json(data);
}

export async function DELETE(request, { params }) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const stepId = searchParams.get("step_id");
  const data = await proxyDelete(`/sequences/${id}/steps`, { step_id: stepId }, api_key);
  return Response.json(data);
}
