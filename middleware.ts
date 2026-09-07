import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import LogtoClient from "@logto/next/edge";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import { createAstraRequestId } from "~/lib/astra/request-id";

const PUBLIC_PATHS = new Set(["/login", "/ganti-password", "/auth/callback"]);
const STATIC_ASSET = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$/;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    STATIC_ASSET.test(pathname)
  ) {
    return true;
  }
  return false;
}

const CANONICAL_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-DNS-Prefetch-Control": "on",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com https://images.unsplash.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.tile.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
} satisfies Record<string, string>;

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CANONICAL_SECURITY_HEADERS)) {
    if (!res.headers.has(key)) {
      res.headers.set(key, value);
    }
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const requestId = createAstraRequestId(req.headers.get("X-Request-ID"));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("X-Request-ID", requestId);

  function createNextResponse(headers: Headers = requestHeaders): NextResponse {
    const res = NextResponse.next({
      request: {
        headers,
      },
    });
    res.headers.set("X-Request-ID", requestId);
    applySecurityHeaders(res);
    return res;
  }

  function createRedirectResponse(url: URL): NextResponse {
    const res = NextResponse.redirect(url);
    res.headers.set("X-Request-ID", requestId);
    applySecurityHeaders(res);
    return res;
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public") ||
    STATIC_ASSET.test(pathname)
  ) {
    return createNextResponse();
  }

  // Keep the Logto client request-scoped. Its adapter owns mutable cookie
  // storage, so sharing one edge client across concurrent requests can make an
  // authenticated request observe another request's empty cookie state.
  const edgeLogtoClient = new LogtoClient(logtoConfig);

  try {
    const logtoContext = await edgeLogtoClient.getLogtoContext(req, {
      fetchUserInfo: false,
    });

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      const mustChangePassword = isPasswordChangeRequired(claims);
      const rawRoles = claims?.roles ?? [];
      const userRole = resolveLogtoRole(rawRoles);

      if (pathname === "/login") {
        if (!userRole || !isPrivilegedRole(userRole)) {
          return createNextResponse();
        }
        const url = req.nextUrl.clone();
        url.pathname = mustChangePassword ? "/ganti-password" : "/dashboard";
        return createRedirectResponse(url);
      }

      if (mustChangePassword) {
        if (pathname !== "/ganti-password" && !isPublicPath(pathname)) {
          const url = req.nextUrl.clone();
          url.pathname = "/ganti-password";
          return createRedirectResponse(url);
        }
        return createNextResponse();
      }

      if (pathname === "/ganti-password") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return createRedirectResponse(url);
      }

      if (!isPublicPath(pathname)) {
        if (!userRole || !isPrivilegedRole(userRole)) {
          const url = req.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "forbidden_role");
          return createRedirectResponse(url);
        }
      }

      return createNextResponse();
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[middleware] [${requestId}] Logto context error:`, err);
    }
  }

  if (!isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const redirectTarget = req.nextUrl.search
      ? `${pathname}${req.nextUrl.search}`
      : pathname;
    url.searchParams.set("redirect", redirectTarget);
    return createRedirectResponse(url);
  }

  return createNextResponse();
}

export const config = {
  matcher: ["/(.*)"],
};
