"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  dashboardDataMessage,
  isRetryableDashboardDataUiState,
  type DashboardDataUiState,
} from "~/server/api/routers/dashboard-data-outcome";

/**
 * Application-owned failure/retry state for the dashboard data boundary
 * (C09). Rendered by the `/dashboard` RSC when its Astra-backed reads fail,
 * instead of letting the rejection escape or showing an empty table. The
 * retry control reuses Next's existing RSC refetch boundary
 * (`router.refresh()`), which re-runs the server queries.
 */
export function DashboardDataError({ state }: { state: DashboardDataUiState }) {
  const router = useRouter();
  const retryable = isRetryableDashboardDataUiState(state);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Data dashboard tidak dapat dimuat</CardTitle>
        <CardDescription>
          Ringkasan informasi dan metrik utama sistem
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
        <p className="text-sm text-muted-foreground text-center" role="alert">
          {dashboardDataMessage(state)}
        </p>
        {retryable && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Muat ulang data dashboard"
            onClick={() => router.refresh()}
          >
            Coba lagi
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
