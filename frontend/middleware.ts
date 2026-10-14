// frontend/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/files"];
// Signing in is the one thing someone already signed in cannot usefully do,
// so these bounce to the dashboard instead of rendering an empty form.
const AUTH_ROUTES = ["/login", "/signup"];

// Asks the backend to verify the JWT (signature + expiry), rather than
// trusting that a "token" cookie merely being present means it's valid.
async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("token")?.value;
  if (!token) return false;

  try {
    // INTERNAL_API_URL lets this server-to-server call reach the backend
    // container directly (e.g. http://backend:3001 under docker-compose),
    // where NEXT_PUBLIC_API_URL's "localhost" would resolve to this
    // container instead.
    const apiUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/auth/me`, {
      headers: { cookie: `token=${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  const isProtected = PROTECTED_ROUTES.some((route) => url.pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => url.pathname.startsWith(route));

  // Nothing to decide, and no reason to spend a round trip on /auth/me.
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(req);

  if (isProtected && !authenticated) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && authenticated) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Apply to certain routes
export const config = {
  matcher: ["/dashboard/:path*", "/files/:path*", "/login", "/signup"],
};
