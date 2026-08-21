import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { astraRequest } from "~/lib/astra/client";

// Valid days enum
const HARI_ENUM = [
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
  "minggu",
] as const;

export type Hari = (typeof HARI_ENUM)[number];

export function isHari(val: string): val is Hari {
  return (
    val === "senin" ||
    val === "selasa" ||
    val === "rabu" ||
    val === "kamis" ||
    val === "jumat" ||
    val === "sabtu" ||
    val === "minggu"
  );
}

const HARI_TO_ID = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
  minggu: 7,
} as const;

const ID_TO_HARI = {
  1: "senin",
  2: "selasa",
  3: "rabu",
  4: "kamis",
  5: "jumat",
  6: "sabtu",
  7: "minggu",
} as const;

export type DayId = keyof typeof ID_TO_HARI;

export function isDayId(id: number): id is DayId {
  return id in ID_TO_HARI;
}

export interface AstraSchedule {
  id: string;
  school_id?: string | null;
  class_id?: string | null;
  academic_period_id?: string | null;
  location_id?: string | null;
  day_of_week?: string;
  hari?: string;
  start_time?: string | null;
  end_time?: string | null;
  start_checkout?: string | null;
  end_checkout?: string | null;
  mulai_masuk?: string | null;
  selesai_masuk?: string | null;
  mulai_pulang?: string | null;
  selesai_pulang?: string | null;
  grace_period_minutes?: number | null;
  kompensasi_waktu?: number | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function mapAstraSchedule(sched: AstraSchedule, indexFallback?: number) {
  const hariRaw = (sched.hari ?? sched.day_of_week ?? "senin").toLowerCase();
  const hari = isHari(hariRaw) ? hariRaw : "senin";
  const numericId = parseInt(sched.id, 10);
  const safeId = !Number.isNaN(numericId)
    ? numericId
    : (HARI_TO_ID[hari] ?? indexFallback ?? 1);

  const formatTime = (t?: string | null, fallback = "00:00:00") => {
    if (!t) return fallback;
    if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
    return t;
  };

  return {
    id: safeId,
    astraId: sched.id,
    hari,
    mulaiMasuk: formatTime(sched.mulai_masuk ?? sched.start_time, "06:30:00"),
    selesaiMasuk: formatTime(sched.selesai_masuk ?? sched.end_time, "07:30:00"),
    mulaiPulang: formatTime(
      sched.mulai_pulang ?? sched.start_checkout,
      "15:00:00",
    ),
    selesaiPulang: formatTime(
      sched.selesai_pulang ?? sched.end_checkout,
      "16:00:00",
    ),
    kompensasiWaktu: sched.kompensasi_waktu ?? sched.grace_period_minutes ?? 0,
    isActive: sched.is_active ?? true,
    createdAt: sched.created_at ? new Date(sched.created_at) : new Date(),
    updatedAt: sched.updated_at ? new Date(sched.updated_at) : new Date(),
  };
}

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
    } catch {
      return [];
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
    } catch {
      return [];
    }
  }),

  // Update schedule by ID
  update: adminProcedure
    .input(
      z.object({
        id: z.number().min(1).max(7),
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
      const targetHari = isDayId(input.id) ? ID_TO_HARI[input.id] : "senin";
      const idStr = String(input.id);
      const target = schedules.find(
        (s, idx) =>
          s.id === idStr ||
          (targetHari &&
            (s.hari ?? s.day_of_week)?.toLowerCase() === targetHari) ||
          idx + 1 === input.id,
      );

      if (target) {
        const updated = await astraRequest<AstraSchedule>(
          `/v1/admin/schedules/${target.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              day_of_week: target.day_of_week ?? targetHari,
              start_time: input.data.mulaiMasuk,
              end_time: input.data.selesaiMasuk,
              start_checkout: input.data.mulaiPulang,
              end_checkout: input.data.selesaiPulang,
              grace_period_minutes: input.data.kompensasiWaktu,
              is_active: input.data.isActive,
            }),
          },
        );
        return mapAstraSchedule(updated, input.id);
      }

      const created = await astraRequest<AstraSchedule>("/v1/admin/schedules", {
        method: "POST",
        body: JSON.stringify({
          day_of_week: targetHari,
          start_time: input.data.mulaiMasuk ?? "06:30:00",
          end_time: input.data.selesaiMasuk ?? "07:30:00",
          start_checkout: input.data.mulaiPulang ?? "15:00:00",
          end_checkout: input.data.selesaiPulang ?? "16:00:00",
          grace_period_minutes: input.data.kompensasiWaktu ?? 0,
          is_active: input.data.isActive ?? true,
        }),
      });
      return mapAstraSchedule(created, input.id);
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
      const results = [];

      for (const item of input) {
        const targetHari = isDayId(item.id) ? ID_TO_HARI[item.id] : "senin";
        const idStr = String(item.id);
        const target = schedules.find(
          (s, idx) =>
            s.id === idStr ||
            (targetHari &&
              (s.hari ?? s.day_of_week)?.toLowerCase() === targetHari) ||
            idx + 1 === item.id,
        );

        if (target) {
          const updated = await astraRequest<AstraSchedule>(
            `/v1/admin/schedules/${target.id}`,
            {
              method: "PUT",
              body: JSON.stringify({
                day_of_week: target.day_of_week ?? targetHari,
                start_time: item.data.mulaiMasuk,
                end_time: item.data.selesaiMasuk,
                start_checkout: item.data.mulaiPulang,
                end_checkout: item.data.selesaiPulang,
                grace_period_minutes: item.data.kompensasiWaktu,
                is_active: item.data.isActive,
              }),
            },
          );
          results.push(mapAstraSchedule(updated, item.id));
        } else {
          const created = await astraRequest<AstraSchedule>(
            "/v1/admin/schedules",
            {
              method: "POST",
              body: JSON.stringify({
                day_of_week: targetHari,
                start_time: item.data.mulaiMasuk ?? "06:30:00",
                end_time: item.data.selesaiMasuk ?? "07:30:00",
                start_checkout: item.data.mulaiPulang ?? "15:00:00",
                end_checkout: item.data.selesaiPulang ?? "16:00:00",
                grace_period_minutes: item.data.kompensasiWaktu ?? 0,
                is_active: item.data.isActive ?? true,
              }),
            },
          );
          results.push(mapAstraSchedule(created, item.id));
        }
      }

      return results;
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.number().min(1).max(7) }))
    .mutation(async ({ input }) => {
      const schedules = await astraRequest<AstraSchedule[]>(
        "/v1/admin/schedules",
      );
      const targetHari = isDayId(input.id) ? ID_TO_HARI[input.id] : "senin";
      const idStr = String(input.id);
      const target = schedules.find(
        (s, idx) =>
          s.id === idStr ||
          (targetHari &&
            (s.hari ?? s.day_of_week)?.toLowerCase() === targetHari) ||
          idx + 1 === input.id,
      );

      if (!target) {
        throw new Error("Jadwal tidak ditemukan");
      }

      const updated = await astraRequest<AstraSchedule>(
        `/v1/admin/schedules/${target.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            is_active: !target.is_active,
          }),
        },
      );

      return mapAstraSchedule(updated, input.id);
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

    const existingSchedules = await astraRequest<AstraSchedule[]>(
      "/v1/admin/schedules",
    ).catch(() => []);

    const results = [];

    for (const def of defaultSchedules) {
      const existing = existingSchedules.find(
        (s, idx) =>
          s.id === String(def.id) ||
          (s.hari ?? s.day_of_week)?.toLowerCase() === def.hari ||
          idx + 1 === def.id,
      );

      const payload = {
        day_of_week: def.hari,
        start_time: def.mulaiMasuk,
        end_time: def.selesaiMasuk,
        start_checkout: def.mulaiPulang,
        end_checkout: def.selesaiPulang,
        grace_period_minutes: def.kompensasiWaktu,
        is_active: def.isActive,
      };

      if (existing) {
        const updated = await astraRequest<AstraSchedule>(
          `/v1/admin/schedules/${existing.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );
        results.push(mapAstraSchedule(updated, def.id));
      } else {
        const created = await astraRequest<AstraSchedule>(
          "/v1/admin/schedules",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        results.push(mapAstraSchedule(created, def.id));
      }
    }

    return results;
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
