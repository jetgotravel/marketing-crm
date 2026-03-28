import { createSupabaseMiddleware } from "./lib/supabase-middleware.js";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip auth for these paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/dashboard/auth") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return;
  }

  const { supabase, response } = createSupabaseMiddleware(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return Response.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
