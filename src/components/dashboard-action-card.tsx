"use client";

import { UserPlus, ClipboardPlus } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

// Lazy-import the inner form portions isn't needed — we just import the full
// dialog components and control their open state from here so we can use
// custom tile triggers while re-using the existing dialog content.

import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { IzinManualDialog } from "~/components/izin-manual-dialog";

export function DashboardActionCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-4 p-6">
        {/* Absen Manual tile */}
        <AbsenManualDialog
          trigger={
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-background px-8 py-6 shadow-sm transition-colors hover:bg-accent hover:border-primary/30 cursor-pointer w-[140px] h-[130px]"
            >
              <UserPlus className="h-8 w-8 text-green-600" strokeWidth={1.5} />
              <span className="text-sm font-medium">Absen Manual</span>
            </button>
          }
        />

        {/* Izin Manual tile */}
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
