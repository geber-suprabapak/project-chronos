"use client";

import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { IzinManualDialog } from "~/components/izin-manual-dialog";
import { Card, CardContent } from "~/components/ui/card";

export function DashboardActionCard() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <AbsenManualDialog />
        <IzinManualDialog />
      </CardContent>
    </Card>
  );
}
