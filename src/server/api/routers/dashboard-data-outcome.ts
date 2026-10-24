/**
 * Pure outcome mapping for the dashboard data boundary (C09): the
 * `/dashboard` RSC reads (`perizinan.list` pending table and the
 * attendance-summary chart) must own their failure state instead of
 * surfacing an uncaught rejection or an empty-data success.
 *
 * Reuse rule: this boundary deliberately delegates to the existing Leave
 * classification (`perizinan-detail.ts`, C05) — the dashboard's pending
 * perizinan table is a Leave collection read, so the tRPC error code → UI
 * outcome mapping is the same one, not a new shared abstraction. C01b, C05,
 * and C07 keep their own feature-level retry behavior untouched.
 *
 * Privacy rule: the client-visible message is fixed per outcome class and
 * never echoes the upstream status, code, or correlation identifiers.
 */

import {
  isRetryableLeaveDetailUiState,
  leaveDetailUiState,
  type LeaveDetailUiState,
} from "./perizinan-detail.ts";

export type DashboardDataUiState = Exclude<LeaveDetailUiState, "not_found">;

export const DASHBOARD_DATA_MESSAGES = {
  forbidden: "Anda tidak memiliki izin untuk memuat data dashboard.",
  dependency: "Data dashboard sedang tidak tersedia. Coba lagi beberapa saat.",
  unknown:
    "Terjadi kesalahan saat memuat data dashboard. Coba lagi beberapa saat.",
} as const;

/**
 * Maps a tRPC error code (from a `TRPCError.code` observed at the dashboard
 * RSC boundary, or an absent code when the query failed before a tRPC
 * response existed) onto the dashboard UI outcome class. A dashboard list
 * read has no not-found outcome: a NOT_FOUND code cannot identify a missing
 * record, so it surfaces as a recoverable dependency failure instead of an
 * empty table.
 */
export function dashboardDataUiState(
  code: string | null | undefined,
): DashboardDataUiState {
  const state = leaveDetailUiState(code);
  return state === "not_found" ? "dependency" : state;
}

/** Whether a dashboard UI outcome class offers a retry control. */
export function isRetryableDashboardDataUiState(
  state: DashboardDataUiState,
): boolean {
  return isRetryableLeaveDetailUiState(state);
}

/** Client-safe message for a dashboard UI outcome class. */
export function dashboardDataMessage(state: DashboardDataUiState): string {
  switch (state) {
    case "forbidden":
      return DASHBOARD_DATA_MESSAGES.forbidden;
    case "dependency":
      return DASHBOARD_DATA_MESSAGES.dependency;
    default:
      return DASHBOARD_DATA_MESSAGES.unknown;
  }
}
