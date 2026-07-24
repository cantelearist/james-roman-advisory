import { buildSecurityHeaders } from "./src/lib/security";
import type { NextConfig } from "next";

const privateSurfaceHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store, max-age=0" },
];

const privateHeaderSources = [
  "/api",
  "/api/:path*",
  "/mfa-required",
  "/mfa-required/:path*",
  "/portal",
  "/portal/:path*",
  "/sign-in",
  "/sign-in/:path*",
  "/sign-up",
  "/sign-up/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(),
      },
      ...privateHeaderSources.map((source) => ({
        source,
        headers: privateSurfaceHeaders,
      })),
    ];
  },
};

export default nextConfig;
