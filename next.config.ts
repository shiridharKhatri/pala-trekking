import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 768, 1080, 1440, 1920, 2400],
    qualities: [60, 72, 80],
    // Uploaded admin media is served from /uploads (local disk in development).
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/uploads/**" }],
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
