import { TRPCError } from "@trpc/server";
// Relative import: this module must stay importable under `node --test`
// (the `~/` alias is only resolved by Bun/Next, not by the Node test runner).
import {
  HARI_ENUM,
  HARI_TO_ID,
  mapAstraSchedule,
  type AstraSchedule,
} from "./jadwal-mapping.ts";

export const DAY_LABELS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export type ScheduleWrite = {
  id: number;
  hari: (typeof HARI_ENUM)[number];
  payload: Record<string, string | number | boolean>;
};

export type SchedulePayload = ScheduleWrite["payload"];

/**
 * Transport boundary for per-day schedule writes. The router supplies an
 * Astra-backed adapter; tests supply in-memory fixtures. Keeping the
 * orchestration behind this interface lets `node --test` verify
 * partial-outcome/recovery behavior without importing the Logto/Astra client
 * stack.
 */
export interface ScheduleBatchClient {
  listSchedules(): Promise<AstraSchedule[]>;
  updateSchedule(id: string, payload: SchedulePayload): Promise<AstraSchedule>;
  createSchedule(payload: SchedulePayload): Promise<AstraSchedule>;
}

export function findSchedule(
  schedules: AstraSchedule[],
  id: number,
  hari: (typeof HARI_ENUM)[number],
) {
  return schedules.find(
    (schedule, index) =>
      schedule.id === String(id) ||
      (schedule.hari ?? schedule.day_of_week)?.toLowerCase() === hari ||
      index + 1 === id,
  );
}

export function matchesSchedule(
  schedule: AstraSchedule | undefined,
  payload: SchedulePayload,
) {
  if (!schedule) return false;
  return (
    (payload.day_of_week === undefined ||
      schedule.day_of_week === payload.day_of_week) &&
    (payload.start_time === undefined ||
      (schedule.start_time ?? schedule.mulai_masuk) === payload.start_time) &&
    (payload.end_time === undefined ||
      (schedule.end_time ?? schedule.selesai_masuk) === payload.end_time) &&
    (payload.start_checkout === undefined ||
      (schedule.start_checkout ?? schedule.mulai_pulang) ===
        payload.start_checkout) &&
    (payload.end_checkout === undefined ||
      (schedule.end_checkout ?? schedule.selesai_pulang) ===
        payload.end_checkout) &&
    (payload.grace_period_minutes === undefined ||
      (schedule.grace_period_minutes ?? schedule.kompensasi_waktu) ===
        payload.grace_period_minutes) &&
    (payload.is_active === undefined ||
      schedule.is_active === payload.is_active)
  );
}

function partialScheduleError(
  outcomes: { hari: (typeof HARI_ENUM)[number]; status: string }[],
  error: Error,
) {
  const summary = outcomes
    .map(({ hari, status }) => {
      const label = DAY_LABELS[HARI_TO_ID[hari] - 1];
      return `${label}: ${status}`;
    })
    .join("; ");
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Perubahan jadwal sebagian. ${summary}. Ulangi setelah memeriksa jadwal terbaru; hari yang sudah sesuai tidak akan ditulis ulang.`,
    cause: error,
  });
}

/**
 * Apply per-day schedule writes sequentially, exactly like the existing
 * single-day Astra calls. Astra batch semantics are not atomic: a later write
 * can fail after earlier ones committed. Every day therefore gets an explicit
 * outcome (tersimpan / gagal / belum dicoba), a failed write is re-read from
 * the authoritative list before classification (its commit status may be
 * ambiguous), and a retry skips days that already match so committed writes
 * are never duplicated or blindly replayed.
 */
export async function applyScheduleWrites(
  plan: ScheduleWrite[],
  initialSchedules: AstraSchedule[],
  client: ScheduleBatchClient,
) {
  let schedules = initialSchedules;
  const results = [];
  const outcomes: { hari: (typeof HARI_ENUM)[number]; status: string }[] = [];

  for (const [index, item] of plan.entries()) {
    const existing = findSchedule(schedules, item.id, item.hari);
    if (existing && matchesSchedule(existing, item.payload)) {
      results.push(mapAstraSchedule(existing, item.id));
      outcomes.push({ hari: item.hari, status: "tersimpan" });
      continue;
    }

    try {
      const updated = existing
        ? await client.updateSchedule(existing.id, item.payload)
        : await client.createSchedule(item.payload);
      schedules = existing
        ? schedules.map((schedule) =>
            schedule.id === existing.id ? updated : schedule,
          )
        : [...schedules, updated];
      results.push(mapAstraSchedule(updated, item.id));
      outcomes.push({ hari: item.hari, status: "tersimpan" });
    } catch (error) {
      try {
        // A failed/timeout response may follow a committed write. Re-read the
        // domain state before classifying the day or allowing a safe retry.
        schedules = await client.listSchedules();
      } catch (readError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Status perubahan ${DAY_LABELS[item.id - 1]} belum dapat diverifikasi dari jadwal terbaru. Muat ulang jadwal sebelum mencoba kembali.`,
          cause: readError,
        });
      }

      const afterFailure = findSchedule(schedules, item.id, item.hari);
      const committed = matchesSchedule(afterFailure, item.payload);
      if (committed && afterFailure) {
        results.push(mapAstraSchedule(afterFailure, item.id));
        outcomes.push({ hari: item.hari, status: "tersimpan" });
      } else {
        outcomes.push({ hari: item.hari, status: "gagal" });
      }
      for (const notAttempted of plan.slice(index + 1)) {
        outcomes.push({ hari: notAttempted.hari, status: "belum dicoba" });
      }
      throw partialScheduleError(
        outcomes,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  return results;
}
