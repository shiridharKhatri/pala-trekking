import { NextResponse, type NextRequest } from "next/server";
import { slugExists } from "./lib/slug-index";

// 1. Optimistic admin check only: real authorisation happens in lib/auth.ts
//    on every admin page and server action.
// 2. Real 404 status for unknown trek / gateway / experience URLs. Those pages
//    are partially prerendered, so their static shell is sent with 200 before
//    the page can call notFound(); deciding here, before rendering, keeps the
//    status honest for search engines and monitoring.
// Security headers live in next.config.ts so they also cover static assets.

const DETAIL = /^\/(treks|gateways|experiences)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const hasSession = req.cookies.has("__Host-pt_admin") || req.cookies.has("pt_admin");
    if (pathname !== "/admin/login" && !hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const m = pathname.match(DETAIL);
  if (m) {
    const exists = await slugExists(m[1] as "treks" | "gateways" | "experiences", m[2]);
    if (exists === false) {
      // A path that matches no route renders app/not-found.tsx with status 404.
      const url = req.nextUrl.clone();
      url.pathname = "/_not-found-404";
      return NextResponse.rewrite(url);
    }
  } else if (/^\/(treks|gateways|experiences)\/[^/]+/.test(pathname)) {
    // Malformed slug (uppercase, punctuation, nested path): never a real page.
    const url = req.nextUrl.clone();
    url.pathname = "/_not-found-404";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/treks/:path+", "/gateways/:path+", "/experiences/:path+"],
};
