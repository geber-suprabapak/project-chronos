import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  canAccessProfiles,
  resolveLogtoRole,
} from "~/server/auth/rbac";

export default async function ProfilesLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    const logtoContext = await getLogtoContext(logtoConfig);

    if (!logtoContext.isAuthenticated || !logtoContext.claims) {
      redirect("/login");
    }

    const claims = extractExtendedClaims(logtoContext.claims);
    if (isPasswordChangeRequired(claims)) {
      redirect("/ganti-password");
    }

    const rawRoles = claims?.roles ?? [];
    const userRole = resolveLogtoRole(rawRoles);
    if (!canAccessProfiles(userRole)) {
      redirect("/dashboard");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}
