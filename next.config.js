/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com https://storage.lunaradev.my.id",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.tile.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  // pnpm's symlinked dependency tree can otherwise trace only the CJS half of
  // @swc/helpers. Next's standalone server may select a package export on
  // newer Node runtimes, so keep the complete helper package in the artifact.
  outputFileTracingIncludes: {
    "/*": ["node_modules/@swc/helpers/**/*"],
  },
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default config;
