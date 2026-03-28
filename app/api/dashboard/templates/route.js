import { verifyDashboardAuth, unauthorizedResponse } from "../../../../lib/auth";
import { proxyGet, proxyPost } from "../../../../lib/proxy";

export async function GET(request) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const data = await proxyGet("/templates", searchParams, api_key);
  return Response.json(data);
}

export async function POST(request) {
  const { authorized, api_key } = await verifyDashboardAuth();
  if (!authorized) return unauthorizedResponse();

  const body = await request.json();
  const data = await proxyPost("/templates", body, api_key);
  return Response.json(data);
}
