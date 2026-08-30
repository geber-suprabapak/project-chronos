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

const PUBLIC_PATHS = new Set(["/login", "/ganti-password", "/auth/callback"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public")
  ) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  // Keep the Logto client request-scoped. Its adapter owns mutable cookie
  // storage, so sharing one edge client across concurrent requests can make an
  // authenticated request observe another request's empty cookie state.
  const edgeLogtoClient = new LogtoClient(logtoConfig);

  try {
    const logtoContext = await edgeLogtoClient.getLogtoContext(req);

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      const mustChangePassword = isPasswordChangeRequired(claims);
      const rawRoles = claims?.roles ?? [];
      const userRole = resolveLogtoRole(rawRoles);

      if (pathname === "/login") {
        if (!userRole || !isPrivilegedRole(userRole)) {
          return NextResponse.next();
        }
        const url = req.nextUrl.clone();
        url.pathname = mustChangePassword ? "/ganti-password" : "/dashboard";
        return NextResponse.redirect(url);
      }

      if (mustChangePassword) {
        if (pathname !== "/ganti-password" && !isPublicPath(pathname)) {
          const url = req.nextUrl.clone();
          url.pathname = "/ganti-password";
          return NextResponse.redirect(url);
        }
        return NextResponse.next();
      }

      if (pathname === "/ganti-password") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      if (!isPublicPath(pathname)) {
        if (!userRole || !isPrivilegedRole(userRole)) {
          const url = req.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "forbidden_role");
          return NextResponse.redirect(url);
        }
      }

      return NextResponse.next();
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[middleware] Logto context error:", err);
    }
  }

  if (!isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"],
};
