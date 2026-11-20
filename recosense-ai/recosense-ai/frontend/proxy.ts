import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Optimistic route protection. Reads the JWT mirrored into the `rs_token` cookie and redirects
 * before rendering. The signature is NOT verified here — the FastAPI backend verifies every request,
 * so this only improves UX (no flash of protected pages).
 */
function readPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("rs_token")?.value;
  const payload = token ? readPayload(token) : null;
  const valid = payload && (!payload.exp || payload.exp * 1000 > Date.now());

  if (!valid) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && payload.role !== "admin") {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home", "/recommendations", "/ai-assistant", "/wishlist", "/cart", "/checkout", "/orders/:path*",
    "/profile", "/admin/:path*",
  ],
};
