import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: real authorisation happens in lib/auth.ts on every
// admin page and server action. Security headers live in next.config.ts so
// they also cover static assets.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("__Host-pt_admin") || req.cookies.has("pt_admin");
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
