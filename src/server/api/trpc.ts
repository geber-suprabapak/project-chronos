/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isAdminRole,
  isMfaVerified,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import {
  ADMIN_ROLES,
  PRIVILEGED_ROLES,
  type AppRole,
  hasRequiredRole,
  resolveUserRole,
} from "~/server/auth/rbac";
import type { User } from "@supabase/supabase-js";

import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    db,
    ...opts,
  };
};

export type AuthenticatedContext = Awaited<
  ReturnType<typeof createTRPCContext>
> & {
  user: User;
  userRole: AppRole;
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create({
    transformer: superjson,
    errorFormatter(opts) {
      const formattedError = opts["shape"];
      const error = opts.error;
      return {
        ...formattedError,
        data: {
          ...formattedError.data,
          zodError:
            error.cause instanceof ZodError
              ? z.flattenError(error.cause)
              : null,
        },
      };
    },
  });

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Authentication middleware - resolves user role and adds to context
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  try {
    const logtoContext = await getLogtoContext(logtoConfig, {
      fetchUserInfo: true,
    });

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      if (isPasswordChangeRequired(claims)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Password change required.",
        });
      }

      const rawRoles = claims?.roles ?? [];
      const userRole = resolveLogtoRole(rawRoles);

      if (!userRole || !isPrivilegedRole(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Forbidden role.",
        });
      }

      if (isAdminRole(userRole)) {
        const mfaOk = isMfaVerified(claims?.mfa_verified, claims?.amr);
        if (!mfaOk) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "MFA verification required.",
          });
        }
      }

      // SAFETY: logtoContext userInfo contains standard OIDC email claim
      const fallbackEmail = logtoContext.userInfo?.email as string | undefined;
      const email = claims?.email ?? fallbackEmail ?? "";
      // SAFETY: logtoContext userInfo contains standard OIDC name claim
      const fullName = logtoContext.userInfo?.name as string | undefined;

      const user: User = {
        id: claims?.sub ?? "",
        email,
        app_metadata: { role: userRole },
        user_metadata: {
          full_name: fullName ?? email,
        },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      if (process.env.NODE_ENV === "development") {
        console.log(`[tRPC Auth (Logto)] user=${user.id} role=${userRole}`);
      }

      return next({
        ctx: {
          ...ctx,
          user,
          userRole,
        },
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[tRPC Auth] Logto context check failed, falling back:",
        err,
      );
    }
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const userRole = await resolveUserRole(ctx.db, user);

  if (process.env.NODE_ENV === "development") {
    console.log(`[tRPC Auth] user=${user.id} role=${userRole}`);
  }

  return next({
    ctx: {
      ...ctx,
      user,
      userRole,
    },
  });
});

/**
 * Role-based authorization middleware
 * Assumes isAuthed middleware has run first
 */
const requireRole = (allowedRoles: readonly AppRole[]) =>
  protectedProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      // SAFETY: isAuthed middleware has populated user and userRole on ctx
      const authenticatedCtx = ctx as AuthenticatedContext;

      if (!hasRequiredRole(authenticatedCtx.userRole, allowedRoles)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return next();
    }),
  );

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Admin-only procedure
 */
export const adminProcedure = requireRole(ADMIN_ROLES);

/**
 * Privileged procedure - admin, kepala_sekolah, guru, or wali_kelas
 */
export const privilegedProcedure = requireRole(PRIVILEGED_ROLES);
