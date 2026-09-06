import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  canAccessConfiguration,
  resolveLogtoRole,
} from "~/server/auth/rbac";

export default async function KonfigurasiLayout({
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
    if (!canAccessConfiguration(userRole)) {
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
