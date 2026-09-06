"use client";

import * as React from "react";
import { UserPlus, ClipboardPlus } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { IzinManualDialog } from "~/components/izin-manual-dialog";
import {
  type AppRole,
  canManageManualAttendance,
  resolveLogtoRole,
} from "~/server/auth/rbac";

export function DashboardActionCard({
  role,
  isAdmin: directIsAdmin,
}: {
  role?: AppRole | null;
  isAdmin?: boolean;
} = {}) {
  const [canManualAttendance, setCanManualAttendance] = React.useState<boolean>(
    directIsAdmin ?? canManageManualAttendance(role),
  );

  React.useEffect(() => {
    if (directIsAdmin !== undefined || role !== undefined) return;
    let active = true;
    void fetch("/api/logto/user")
      .then(async (response) => {
        if (!response.ok) return null;
        // SAFETY: /api/logto/user returns the documented Logto context envelope.
        const context = (await response.json()) as {
          claims?: { roles?: string[] } | null;
          userInfo?: { roles?: string[] } | null;
        };
        const resolvedRole = resolveLogtoRole(
          context.claims?.roles ?? context.userInfo?.roles ?? [],
        );
        return canManageManualAttendance(resolvedRole);
      })
      .then((allowed) => {
        if (active && allowed !== null) {
          setCanManualAttendance(allowed);
        }
      })
      .catch(() => {
        if (active) setCanManualAttendance(false);
      });
    return () => {
      active = false;
    };
  }, [directIsAdmin, role]);

  return (
    <Card className="h-full min-w-0 w-full">
      <CardContent className="flex h-full items-center justify-center gap-4 p-4 sm:p-6 min-w-0">
        {/* Absen Manual tile - Governed by canManageManualAttendance */}
        {canManualAttendance && (
          <AbsenManualDialog
            trigger={
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background px-8 py-6 shadow-sm transition-colors hover:bg-accent hover:border-primary/30 cursor-pointer w-[140px] h-[130px]"
              >
                <UserPlus
                  className="h-8 w-8 text-green-600"
                  strokeWidth={1.5}
                />
                <span className="text-sm font-medium">Absen Manual</span>
              </button>
            }
          />
        )}

        {/* Izin Manual tile - Available to all privileged roles */}
        <IzinManualDialog
          trigger={
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background px-8 py-6 shadow-sm transition-colors hover:bg-accent hover:border-warning/30 cursor-pointer w-[140px] h-[130px]"
            >
              <ClipboardPlus
                className="h-8 w-8 text-amber-600"
                strokeWidth={1.5}
              />
              <span className="text-sm font-medium">Izin Manual</span>
            </button>
          }
        />
      </CardContent>
    </Card>
  );
}
