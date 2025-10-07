import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { absences } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/**
 * Router tRPC untuk tabel `absences`.
 *
 * Fitur yang disediakan (READ ONLY):
 *  - list     : Ambil daftar absensi dengan filter (userId, status, tanggal) + pagination.
 *  - getById  : Ambil satu record absensi berdasarkan primary key (id).
 *
 * Catatan Implementasi:
 *  - Validasi input menggunakan Zod agar aman & terstruktur.
 *  - Filter tanggal memakai format YYYY-MM-DD (regex sederhana) sebelum dikirim ke DB.
 *  - Query list membangun array kondisi secara dinamis & hanya menerapkan WHERE jika ada filter.
 *  - Router ini READ ONLY: tidak ada endpoint create/update/delete.
 *  - Tidak ada otorisasi (auth) di sini; middleware bisa ditambahkan kemudian bila diperlukan.
 */

// Basic CRUD router for the absences table
export const absencesRouter = createTRPCRouter({
  // Mengambil daftar absensi dengan opsi filter & pagination.
  // Return: Array record absensi sesuai filter.
  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().uuid().optional(),
          // pagination
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          status: z.string().optional(),
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(), // expecting YYYY-MM-DD
          sort: z.enum(["asc", "desc"]).default("asc"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];
      if (input?.userId) conditions.push(eq(absences.userId, input.userId));
      if (input?.status) conditions.push(eq(absences.status, input.status));
      if (input?.date) conditions.push(eq(absences.date, input.date));

      const where = conditions.length ? and(...conditions) : undefined;

      const rows = await ctx.db.query.absences.findMany({
        where: where,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        orderBy: (absences, { desc, asc }) => [
          (input?.sort ?? "asc") === "desc" ? desc(absences.date) : asc(absences.date)
        ],
        with: {
          userProfile: true,
        },
      });

      return rows;
    }),

  // Mengambil seluruh data absensi (tanpa pagination) - gunakan hati-hati untuk dataset besar.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.absences.findMany({
      orderBy: (absences, { desc }) => [desc(absences.date)],
      with: {
        userProfile: true,
      },
    });
    return rows;
  }),

  // Mengambil satu record berdasarkan ID (primary key). Return null jika tidak ditemukan.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.absences.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
        with: {
          userProfile: true,
        },
      });
      return row ?? null;
    }),

  // Statistik kehadiran untuk dashboard dengan range waktu
  getAttendanceStats: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(7),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Get all user profiles (verified users)
      const allUsers = await ctx.db.query.userProfiles.findMany({
        columns: {
          userId: true,
        },
      });
      const totalUsers = allUsers.length;

      // Get absences within date range
      const absencesData = await ctx.db.query.absences.findMany({
        where: (table, { gte }) => gte(table.date, startDateStr!),
        with: {
          userProfile: true,
        },
      });

      // Get perizinan within date range
      const perizinanData = await ctx.db.query.perizinan.findMany({
        where: (table, { gte }) => gte(table.tanggalUtcDate, startDateStr!),
        with: {
          userProfile: true,
        },
      });

      // Group by date
      const dateMap: Record<string, {
        hadir: Set<string>;
        izin: Set<string>;
      }> = {};

      // Initialize all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        if (dateStr) {
          dateMap[dateStr] = {
            hadir: new Set(),
            izin: new Set(),
          };
        }
      }

      // Fill in attendance data
      absencesData.forEach((a) => {
        const dateStr = a.date; // Already a string in YYYY-MM-DD format
        if (dateStr && dateMap[dateStr]) {
          dateMap[dateStr].hadir.add(a.userId);
        }
      });

      // Fill in permission data
      perizinanData.forEach((p) => {
        const dateStr = p.tanggalUtcDate;
        if (dateStr && dateMap[dateStr] && p.approvalStatus === 'approved') {
          dateMap[dateStr].izin.add(p.userId);
        }
      });

      // Build result array
      const result = Object.entries(dateMap).map(([date, data]) => {
        const hadirCount = data.hadir.size;
        const izinCount = data.izin.size;
        const tidakHadirCount = totalUsers - hadirCount - izinCount;

        return {
          date,
          hadir: hadirCount,
          izin: izinCount,
          tidakHadir: tidakHadirCount > 0 ? tidakHadirCount : 0,
        };
      });

      return result;
    }),
});

export type AbsencesRouter = typeof absencesRouter;
