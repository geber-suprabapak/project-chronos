import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
    createTRPCRouter,
    protectedProcedure,
} from "~/server/api/trpc";
import { jadwalAbsensi } from "~/server/db/schema";

// Valid days enum
const HARI_ENUM = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"] as const;

export const jadwalRouter = createTRPCRouter({
    // Get all schedules
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const schedules = await ctx.db
            .select()
            .from(jadwalAbsensi)
            .orderBy(jadwalAbsensi.id);

        return schedules;
    }),

    // Get schedule by day
    getByHari: protectedProcedure
        .input(z.object({
            hari: z.enum(HARI_ENUM)
        }))
        .query(async ({ ctx, input }) => {
            const schedule = await ctx.db
                .select()
                .from(jadwalAbsensi)
                .where(eq(jadwalAbsensi.hari, input.hari))
                .limit(1);

            return schedule[0] ?? null;
        }),

    // Get schedule by ID
    getById: protectedProcedure
        .input(z.object({ id: z.number().min(1).max(7) }))
        .query(async ({ ctx, input }) => {
            const schedule = await ctx.db
                .select()
                .from(jadwalAbsensi)
                .where(eq(jadwalAbsensi.id, input.id))
                .limit(1);

            return schedule[0] ?? null;
        }),

    // Get current day schedule
    getCurrentDay: protectedProcedure.query(async ({ ctx }) => {
        const dayOfWeek = new Date().getDay();
        const hariMap = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
        const currentHari = hariMap[dayOfWeek];

        const schedule = await ctx.db
            .select()
            .from(jadwalAbsensi)
            .where(eq(jadwalAbsensi.hari, currentHari as typeof HARI_ENUM[number]))
            .limit(1);

        return schedule[0] ?? null;
    }),

    // Get only active schedules
    getActive: protectedProcedure.query(async ({ ctx }) => {
        const schedules = await ctx.db
            .select()
            .from(jadwalAbsensi)
            .where(eq(jadwalAbsensi.isActive, true))
            .orderBy(jadwalAbsensi.id);

        return schedules;
    }),

    // Update schedule by ID
    update: protectedProcedure
        .input(z.object({
            id: z.number().min(1).max(7),
            data: z.object({
                mulaiMasuk: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Format harus HH:MM:SS").optional(),
                selesaiMasuk: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Format harus HH:MM:SS").optional(),
                mulaiPulang: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Format harus HH:MM:SS").optional(),
                selesaiPulang: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, "Format harus HH:MM:SS").optional(),
                kompensasiWaktu: z.number().min(0).max(120).optional(),
                isActive: z.boolean().optional(),
            })
        }))
        .mutation(async ({ ctx, input }) => {
            const updateData: Record<string, unknown> = {
                ...input.data,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            };

            const result = await ctx.db
                .update(jadwalAbsensi)
                .set(updateData)
                .where(eq(jadwalAbsensi.id, input.id))
                .returning();

            return result[0];
        }),

    // Update multiple schedules at once (batch update)
    updateBatch: protectedProcedure
        .input(z.array(z.object({
            id: z.number().min(1).max(7),
            data: z.object({
                mulaiMasuk: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
                selesaiMasuk: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
                mulaiPulang: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
                selesaiPulang: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
                kompensasiWaktu: z.number().min(0).max(120).optional(),
                isActive: z.boolean().optional(),
            })
        })))
        .mutation(async ({ ctx, input }) => {
            const results = [];

            for (const item of input) {
                const updateData: Record<string, unknown> = {
                    ...item.data,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                };

                const result = await ctx.db
                    .update(jadwalAbsensi)
                    .set(updateData)
                    .where(eq(jadwalAbsensi.id, item.id))
                    .returning();

                if (result[0]) {
                    results.push(result[0]);
                }
            }

            return results;
        }),

    // Toggle active status
    toggleActive: protectedProcedure
        .input(z.object({ id: z.number().min(1).max(7) }))
        .mutation(async ({ ctx, input }) => {
            // Get current status
            const current = await ctx.db
                .select()
                .from(jadwalAbsensi)
                .where(eq(jadwalAbsensi.id, input.id))
                .limit(1);

            if (!current[0]) {
                throw new Error("Jadwal tidak ditemukan");
            }

            // Toggle the status
            const result = await ctx.db
                .update(jadwalAbsensi)
                .set({
                    isActive: !current[0].isActive,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(eq(jadwalAbsensi.id, input.id))
                .returning();

            return result[0];
        }),

    // Reset all schedules to default
    reset: protectedProcedure.mutation(async ({ ctx }) => {
        const defaultSchedules = [
            { id: 1, hari: 'senin', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '15:00:00', selesaiPulang: '16:00:00', kompensasiWaktu: 15, isActive: true },
            { id: 2, hari: 'selasa', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '15:00:00', selesaiPulang: '16:00:00', kompensasiWaktu: 15, isActive: true },
            { id: 3, hari: 'rabu', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '15:00:00', selesaiPulang: '16:00:00', kompensasiWaktu: 15, isActive: true },
            { id: 4, hari: 'kamis', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '15:00:00', selesaiPulang: '16:00:00', kompensasiWaktu: 15, isActive: true },
            { id: 5, hari: 'jumat', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '11:00:00', selesaiPulang: '12:00:00', kompensasiWaktu: 15, isActive: true },
            { id: 6, hari: 'sabtu', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '12:00:00', selesaiPulang: '13:00:00', kompensasiWaktu: 15, isActive: false },
            { id: 7, hari: 'minggu', mulaiMasuk: '06:30:00', selesaiMasuk: '07:30:00', mulaiPulang: '15:00:00', selesaiPulang: '16:00:00', kompensasiWaktu: 15, isActive: false },
        ];

        const results = [];

        for (const schedule of defaultSchedules) {
            const result = await ctx.db
                .update(jadwalAbsensi)
                .set({
                    mulaiMasuk: schedule.mulaiMasuk,
                    selesaiMasuk: schedule.selesaiMasuk,
                    mulaiPulang: schedule.mulaiPulang,
                    selesaiPulang: schedule.selesaiPulang,
                    kompensasiWaktu: schedule.kompensasiWaktu,
                    isActive: schedule.isActive,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(eq(jadwalAbsensi.id, schedule.id))
                .returning();

            if (result[0]) {
                results.push(result[0]);
            }
        }

        return results;
    }),

    // Get statistics
    getStats: protectedProcedure.query(async ({ ctx }) => {
        const allSchedules = await ctx.db
            .select()
            .from(jadwalAbsensi)
            .orderBy(jadwalAbsensi.id);

        const activeCount = allSchedules.filter(s => s.isActive).length;
        const avgKompensasi = allSchedules.reduce((sum, s) => sum + s.kompensasiWaktu, 0) / allSchedules.length;

        return {
            total: allSchedules.length,
            active: activeCount,
            inactive: allSchedules.length - activeCount,
            avgKompensasi: Math.round(avgKompensasi),
        };
    }),
});
