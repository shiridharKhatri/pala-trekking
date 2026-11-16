import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Fonts, images and scripts are same-origin; weather
// is fetched server-side. The only third parties the browser talks to are the
// trek map's tile hosts (connect-src), loaded when a visitor reaches the map.
// 'unsafe-inline' scripts are required by Next.js's inline bootstrap without a
// per-request nonce (a nonce would force every page to render dynamically and
// lose prerendering); the remaining directives still block framing, plugin
// content, foreign form targets, <base> hijacking and off-site connections.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Trek map: OpenFreeMap vector tiles + glyphs, AWS Open Data terrain tiles.
  `connect-src 'self' https://tiles.openfreemap.org https://s3.amazonaws.com${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 768, 1080, 1440, 1920, 2400],
    qualities: [60, 72, 80],
    // Uploaded admin media is served from /uploads (local disk in development).
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/uploads/**" }],
  },
  experimental: {
    // Admin image uploads need room; every action validates its own sizes.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded files are never executable content.
      { source: "/uploads/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; sandbox" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
