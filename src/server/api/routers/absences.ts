import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { absences } from "~/server/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
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

      const rows = await ctx.db
        .select()
        .from(absences)
        .where(where ?? undefined)
        .limit(input?.limit ?? 20)
        .offset(input?.offset ?? 0)
        .orderBy(
          (input?.sort ?? "asc") === "desc"
            ? desc(absences.date)
            : asc(absences.date),
        );

      return rows;
    }),

  // Mengambil seluruh data absensi (tanpa pagination) - gunakan hati-hati untuk dataset besar.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(absences)
      .orderBy(desc(absences.date));
    return rows;
  }),

  // Mengambil satu record berdasarkan ID (primary key). Return null jika tidak ditemukan.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.absences.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      });
      return row ?? null;
    }),
});

export type AbsencesRouter = typeof absencesRouter;
