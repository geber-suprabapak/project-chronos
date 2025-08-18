import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { perizinan } from "~/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/**
 * Router tRPC READ ONLY untuk tabel `perizinan`.
 *
 * Endpoint:
 *  - list    : Ambil daftar perizinan dengan filter (userId, kategoriIzin, approvalStatus, status, tanggal) + pagination.
 *  - getById : Ambil satu record perizinan berdasarkan primary key (id UUID).
 *
 * Catatan:
 *  - Tidak ada endpoint create/update/delete (hanya konsumsi data).
 *  - Validasi menggunakan Zod termasuk pembatasan kategoriIzin ("sakit" | "pergi").
 *  - Tanggal difilter menggunakan format YYYY-MM-DD (regex sederhana) jika dikirim.
 *  - WHERE clause dibangun dinamis hanya jika ada filter.
 *  - Middleware auth/role belum diterapkan; bisa ditambahkan kemudian jika diperlukan.
 */
export const perizinanRouter = createTRPCRouter({
  // Mengambil daftar perizinan dengan opsi filter & pagination.
  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().uuid().optional(),
          kategoriIzin: z.enum(["sakit", "pergi"]).optional(),
          approvalStatus: z.string().optional(),
          status: z.boolean().optional(),
          tanggal: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];
      if (input?.userId) conditions.push(eq(perizinan.userId, input.userId));
      if (input?.kategoriIzin)
        conditions.push(eq(perizinan.kategoriIzin, input.kategoriIzin));
      if (input?.approvalStatus)
        conditions.push(eq(perizinan.approvalStatus, input.approvalStatus));
      if (typeof input?.status === "boolean")
        conditions.push(eq(perizinan.status, input.status));
      if (input?.tanggal) conditions.push(eq(perizinan.tanggal, input.tanggal));

      const where = conditions.length ? and(...conditions) : undefined;

      const rows = await ctx.db
        .select()
        .from(perizinan)
        .where(where ?? undefined)
        .limit(input?.limit ?? 20)
        .offset(input?.offset ?? 0)
        .orderBy(perizinan.createdAt);

      return rows;
    }),

  // Mengambil seluruh data perizinan (tanpa pagination) - hati-hati untuk dataset besar.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(perizinan)
      .orderBy(desc(perizinan.createdAt));
    return rows;
  }),

  // Mengambil satu record perizinan berdasarkan UUID primary key.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.perizinan.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
        with: {
          userProfile: true,
        },
      });
      return row ?? null;
    }),

  // Memperbarui status persetujuan perizinan.
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        approvalStatus: z.enum(["approved", "rejected", "pending"]),
        rejectionReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(perizinan)
        .set({
          approvalStatus: input.approvalStatus,
          // Clear rejection fields if status is moved back to pending or approved
          rejectionReason: input.approvalStatus === "rejected" ? input.rejectionReason : null,
          rejectedAt: input.approvalStatus === "rejected" ? new Date() : null,
          rejectedBy: input.approvalStatus === "rejected" ? ctx.user.id : null,
          // Set approval fields only if approved
          approvedAt: input.approvalStatus === "approved" ? new Date() : null,
          approvedBy: input.approvalStatus === "approved" ? ctx.user.id : null,
          // General status boolean
          status: input.approvalStatus === "approved",
          updatedAt: new Date(),
        })
        .where(eq(perizinan.id, input.id))
        .returning();

      return result[0] ?? null;
    }),
});

export type PerizinanRouter = typeof perizinanRouter;
