import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { astraRequest } from "~/lib/astra/client";
import {
  HARI_ENUM,
  HARI_TO_ID,
  ID_TO_HARI,
  isDayId,
  mapAstraSchedule,
  type AstraSchedule,
} from "~/server/api/routers/jadwal-mapping";
import { buildScheduleUpdatePayload } from "~/server/api/routers/jadwal-update";
// Batch/reset orchestration lives in a transport-agnostic module so the
// partial-outcome and recovery behavior is testable under `node --test`.
import {
  applyScheduleWrites,
  findSchedule,
  type ScheduleBatchClient,
  type ScheduleWrite,
} from "~/server/api/routers/jadwal-batch";

export { isDayId, mapAstraSchedule };
export type { AstraSchedule };

const astraScheduleBatchClient: ScheduleBatchClient = {
  listSchedules: () => astraRequest<AstraSchedule[]>("/v1/admin/schedules"),
  updateSchedule: (id, payload) =>
    astraRequest<AstraSchedule>(`/v1/admin/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createSchedule: (payload) =>
    astraRequest<AstraSchedule>("/v1/admin/schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/**
 * Router tRPC untuk entitas `jadwal` (schedules) yang di-route melalui Astra API contract v1.
 */
export const jadwalRouter = createTRPCRouter({
  // Get all schedules
  getAll: protectedProcedure.query(async () => {
    try {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      return schedules
        .map((s, idx) => mapAstraSchedule(s, idx + 1))
        .sort((a, b) => a.id - b.id);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Gagal memuat jadwal dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
        cause: error,
      });
    }
  }),

  // Get schedule by day
  getByHari: protectedProcedure
    .input(
      z.object({
        hari: z.enum(HARI_ENUM),
      }),
    )
    .query(async ({ input }) => {
      try {
        const schedules = await astraRequest<AstraSchedule[]>(
          `/v1/admin/schedules?day_of_week=${input.hari}`,
        );
        const schedule =
          schedules.find(
            (s) =>
              (s.hari ?? s.day_of_week)?.toLowerCase() ===
              input.hari.toLowerCase(),
          ) ?? schedules[0];
        return schedule
          ? mapAstraSchedule(schedule, HARI_TO_ID[input.hari])
          : null;
      } catch {
        return null;
      }
    }),

  // Get schedule by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number().min(1).max(7) }))
    .query(async ({ input }) => {
      try {
        const schedules = await astraRequest<AstraSchedule[]>(
          "/v1/admin/schedules",
        );
        const targetHari = isDayId(input.id) ? ID_TO_HARI[input.id] : undefined;
        const idStr = String(input.id);
        const schedule = schedules.find(
          (s, idx) =>
            s.id === idStr ||
            (targetHari &&
              (s.hari ?? s.day_of_week)?.toLowerCase() === targetHari) ||
            idx + 1 === input.id,
        );
        return schedule ? mapAstraSchedule(schedule, input.id) : null;
      } catch {
        return null;
      }
    }),

  // Get current day schedule
  getCurrentDay: protectedProcedure.query(async () => {
    try {
      const dayOfWeek = new Date().getDay();
      const hariMap = [
        "minggu",
        "senin",
        "selasa",
        "rabu",
        "kamis",
        "jumat",
        "sabtu",
      ] as const;
      const currentHari = hariMap[dayOfWeek];
      if (!currentHari) return null;

      const schedules = await astraRequest<AstraSchedule[]>(
        `/v1/admin/schedules?day_of_week=${currentHari}`,
      );
      const schedule =
        schedules.find(
          (s) => (s.hari ?? s.day_of_week)?.toLowerCase() === currentHari,
        ) ?? schedules[0];
      return schedule
        ? mapAstraSchedule(schedule, HARI_TO_ID[currentHari])
        : null;
    } catch {
      return null;
    }
  }),

  // Get only active schedules
  getActive: protectedProcedure.query(async () => {
    try {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules?is_active=true",
      );
      return schedules
        .filter((s) => s.is_active)
        .map((s, idx) => mapAstraSchedule(s, idx + 1))
        .sort((a, b) => a.id - b.id);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Gagal memuat jadwal aktif dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
        cause: error,
      });
    }
  }),

  // Update schedule by ID
  update: adminProcedure
    .input(
      z.object({
        astraId: z.string().min(1).max(128),
        data: z.object({
          mulaiMasuk: z
            .string()
            .regex(
              /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
              "Format harus HH:MM:SS",
            )
            .optional(),
          selesaiMasuk: z
            .string()
            .regex(
              /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
              "Format harus HH:MM:SS",
            )
            .optional(),
          mulaiPulang: z
            .string()
            .regex(
              /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
              "Format harus HH:MM:SS",
            )
            .optional(),
          selesaiPulang: z
            .string()
            .regex(
              /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/,
              "Format harus HH:MM:SS",
            )
            .optional(),
          kompensasiWaktu: z.number().min(0).max(120).optional(),
          isActive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      const target = schedules.find((s) => s.id === input.astraId);
      if (!target) {
        throw new Error("Jadwal tidak ditemukan");
      }

      const payload = buildScheduleUpdatePayload(input.data);
      if (Object.keys(payload).length === 0) {
        throw new Error("Pilih setidaknya satu nilai jadwal untuk diperbarui.");
      }

      const updated = await astraRequest<AstraSchedule>(
        `/v1/admin/schedules/${encodeURIComponent(target.id)}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      return mapAstraSchedule(updated);
    }),

  // Update multiple schedules at once (batch update)
  updateBatch: adminProcedure
    .input(
      z.array(
        z.object({
          id: z.number().min(1).max(7),
          data: z.object({
            mulaiMasuk: z
              .string()
              .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
              .optional(),
            selesaiMasuk: z
              .string()
              .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
              .optional(),
            mulaiPulang: z
              .string()
              .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
              .optional(),
            selesaiPulang: z
              .string()
              .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
              .optional(),
            kompensasiWaktu: z.number().min(0).max(120).optional(),
            isActive: z.boolean().optional(),
          }),
        }),
      ),
    )
    .mutation(async ({ input }) => {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      const plan: ScheduleWrite[] = input.map((item) => {
        // SAFETY: the zod input schema constrains id to 1..7, exactly the
        // ID_TO_HARI keys, so the assertion cannot hit an undefined day.
        const hari = ID_TO_HARI[item.id as keyof typeof ID_TO_HARI];
        const partialPayload = buildScheduleUpdatePayload(item.data);
        if (Object.keys(partialPayload).length === 0) {
          throw new Error(
            "Pilih setidaknya satu nilai jadwal untuk diperbarui.",
          );
        }
        const target = findSchedule(schedules, item.id, hari);
        return {
          id: item.id,
          hari,
          payload: target
            ? partialPayload
            : {
                day_of_week: hari,
                start_time: item.data.mulaiMasuk ?? "06:30:00",
                end_time: item.data.selesaiMasuk ?? "07:30:00",
                start_checkout: item.data.mulaiPulang ?? "15:00:00",
                end_checkout: item.data.selesaiPulang ?? "16:00:00",
                grace_period_minutes: item.data.kompensasiWaktu ?? 0,
                is_active: item.data.isActive ?? true,
              },
        };
      });
      return applyScheduleWrites(plan, schedules, astraScheduleBatchClient);
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ astraId: z.string().min(1).max(128) }))
    .mutation(async ({ input }) => {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      const target = schedules.find((s) => s.id === input.astraId);
      if (!target) {
        throw new Error("Jadwal tidak ditemukan");
      }

      const updated = await astraRequest<AstraSchedule>(
        `/v1/admin/schedules/${encodeURIComponent(target.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            is_active: !target.is_active,
          }),
        },
      );

      return mapAstraSchedule(updated);
    }),

  // Reset all schedules to default
  reset: adminProcedure.mutation(async () => {
    const defaultSchedules = [
      {
        id: 1,
        hari: "senin",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "15:00:00",
        selesaiPulang: "16:00:00",
        kompensasiWaktu: 15,
        isActive: true,
      },
      {
        id: 2,
        hari: "selasa",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "15:00:00",
        selesaiPulang: "16:00:00",
        kompensasiWaktu: 15,
        isActive: true,
      },
      {
        id: 3,
        hari: "rabu",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "15:00:00",
        selesaiPulang: "16:00:00",
        kompensasiWaktu: 15,
        isActive: true,
      },
      {
        id: 4,
        hari: "kamis",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "15:00:00",
        selesaiPulang: "16:00:00",
        kompensasiWaktu: 15,
        isActive: true,
      },
      {
        id: 5,
        hari: "jumat",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "11:00:00",
        selesaiPulang: "12:00:00",
        kompensasiWaktu: 15,
        isActive: true,
      },
      {
        id: 6,
        hari: "sabtu",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "12:00:00",
        selesaiPulang: "13:00:00",
        kompensasiWaktu: 15,
        isActive: false,
      },
      {
        id: 7,
        hari: "minggu",
        mulaiMasuk: "06:30:00",
        selesaiMasuk: "07:30:00",
        mulaiPulang: "15:00:00",
        selesaiPulang: "16:00:00",
        kompensasiWaktu: 15,
        isActive: false,
      },
    ];

    let existingSchedules: AstraSchedule[];
    try {
      existingSchedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Gagal memuat jadwal dari Astra saat mereset jadwal: ${error instanceof Error ? error.message : "Unknown error"}`,
        cause: error,
      });
    }

    const plan: ScheduleWrite[] = defaultSchedules.map((def) => ({
      id: def.id,
      // SAFETY: every defaultSchedules entry uses one of the seven literals
      // of HARI_ENUM, so the assertion only narrows the literal union.
      hari: def.hari as (typeof HARI_ENUM)[number],
      payload: {
        day_of_week: def.hari,
        start_time: def.mulaiMasuk,
        end_time: def.selesaiMasuk,
        start_checkout: def.mulaiPulang,
        end_checkout: def.selesaiPulang,
        grace_period_minutes: def.kompensasiWaktu,
        is_active: def.isActive,
      },
    }));

    return applyScheduleWrites(
      plan,
      existingSchedules,
      astraScheduleBatchClient,
    );
  }),

  // Get statistics
  getStats: protectedProcedure.query(async () => {
    try {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      const mapped = schedules.map((s, idx) => mapAstraSchedule(s, idx + 1));
      const activeCount = mapped.filter((s) => s.isActive).length;
      const avgKompensasi =
        mapped.length > 0
          ? mapped.reduce((sum, s) => sum + s.kompensasiWaktu, 0) /
            mapped.length
          : 0;

      return {
        total: mapped.length,
        active: activeCount,
        inactive: mapped.length - activeCount,
        avgKompensasi: Math.round(avgKompensasi),
      };
    } catch {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        avgKompensasi: 0,
      };
    }
  }),
});
