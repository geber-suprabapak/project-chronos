import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import LogtoClient from "@logto/next/edge";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isAdminRole,
  isMfaVerified,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import { createSupabaseMiddlewareClient } from "~/lib/supabase/middleware";

const PUBLIC_PATHS = new Set(["/login", "/ganti-password", "/auth/callback"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/logto")) return true;
  if (pathname.startsWith("/api/health")) return true;
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

const edgeLogtoClient = new LogtoClient(logtoConfig);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  try {
    const logtoContext = await edgeLogtoClient.getLogtoContext(req);

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      const mustChangePassword = isPasswordChangeRequired(claims);
      const rawRoles = claims?.roles ?? [];
      const userRole = resolveLogtoRole(rawRoles);

      if (pathname === "/login") {
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

        if (isAdminRole(userRole)) {
          const mfaOk = isMfaVerified(claims?.mfa_verified, claims?.amr);
          if (!mfaOk) {
            const url = req.nextUrl.clone();
            url.pathname = "/login";
            url.searchParams.set("error", "mfa_required");
            return NextResponse.redirect(url);
          }
        }
      }

      return NextResponse.next();
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[middleware] Logto context error, falling back:", err);
    }
  }

  // Fallback to legacy Supabase session if Logto session is not present
  const { supabase, response } = createSupabaseMiddlewareClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mustChangePassword =
    user?.user_metadata?.must_change_password === true ||
    user?.user_metadata?.must_change_password === 1 ||
    user?.user_metadata?.must_change_password === "true" ||
    user?.user_metadata?.must_change_password === "1" ||
    user?.user_metadata?.must_change_password === "yes";

  if (pathname === "/login" && user) {
    const url = req.nextUrl.clone();
    url.pathname = mustChangePassword ? "/ganti-password" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    mustChangePassword &&
    pathname !== "/ganti-password" &&
    !isPublicPath(pathname)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/ganti-password";
    return NextResponse.redirect(url);
  }

  if (user && !mustChangePassword && pathname === "/ganti-password") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/(.*)"],
};
