import { z } from "zod";
import {
  createTRPCRouter,
  privilegedProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { hasRequiredRole, PRIVILEGED_ROLES } from "~/server/auth/rbac";
import { perizinan } from "~/server/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
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
 *  - Endpoint baca dibatasi berdasarkan role: siswa hanya dapat melihat datanya sendiri.
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
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(), // Alias for tanggal
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: SQL[] = [];

      if (!hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES)) {
        conditions.push(eq(perizinan.userId, ctx.user.id));
      }

      if (input?.userId) conditions.push(eq(perizinan.userId, input.userId));
      if (input?.kategoriIzin)
        conditions.push(eq(perizinan.kategoriIzin, input.kategoriIzin));
      if (input?.approvalStatus)
        conditions.push(eq(perizinan.approvalStatus, input.approvalStatus));
      if (input?.status !== undefined)
        conditions.push(eq(perizinan.status, input.status));
      // Filter per hari berdasarkan zona lokal (WIB, UTC+7) dengan rentang [start, end)
      const dateParam = input?.date ?? input?.tanggal;
      if (dateParam) {
        const startLocal = new Date(`${dateParam}T00:00:00+07:00`);
        const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
        conditions.push(gte(perizinan.tanggal, startLocal));
        conditions.push(lt(perizinan.tanggal, endLocal));
      }

      const where = conditions.length ? and(...conditions) : undefined;

      const rows = await ctx.db.query.perizinan.findMany({
        where: where,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        orderBy: (perizinan, { desc }) => [
          desc(perizinan.tanggal),
          desc(perizinan.createdAt),
        ],
        with: {
          userProfile: true,
        },
      });

      // Filter out entries created from manual absence (identified by specific keywords in description)
      const filtered = rows.filter((row) => {
        const desc = (row.deskripsi ?? "").toLowerCase();
        // Exclude if description is exactly "terlambat" or "dipulangkan" (from absen manual)
        return desc !== "terlambat" && desc !== "dipulangkan";
      });

      return filtered;
    }),

  // Mengambil seluruh data perizinan (tanpa pagination) - hati-hati untuk dataset besar.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const where = hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES)
      ? undefined
      : eq(perizinan.userId, ctx.user.id);

    const rows = await ctx.db.query.perizinan.findMany({
      where,
      orderBy: (perizinan, { desc }) => [desc(perizinan.createdAt)],
      with: {
        userProfile: true,
      },
    });
    // Filter out entries created from manual absence (identified by specific keywords in description)
    const filtered = rows.filter((row) => {
      const desc = (row.deskripsi ?? "").toLowerCase();
      // Exclude if description is exactly "terlambat" or "dipulangkan" (from absen manual)
      return desc !== "terlambat" && desc !== "dipulangkan";
    });
    return filtered;
  }),

  // CREATE MANUAL: Admin input izin manual
  createManual: privilegedProcedure
    .input(
      z.object({
        nis: z.string(),
        kategoriIzin: z.enum(["sakit", "pergi"]),
        deskripsi: z.string().optional(),
        linkFoto: z.string().optional(),
        tanggal: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Get siswa from biodata_siswa by NIS
      const siswa = await ctx.db.query.biodataSiswa.findFirst({
        where: (table, { eq }) => eq(table.nis, BigInt(input.nis)),
      });

      if (!siswa) {
        throw new Error(
          "Siswa dengan NIS tersebut tidak ditemukan di database",
        );
      }

      // Get user_profile to find user_id
      const userProfile = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.nis, siswa.nis.toString()),
      });

      if (!userProfile) {
        throw new Error(
          `Siswa ${siswa.nama ?? siswa.nis} belum memiliki akun user. ` +
            `Siswa harus aktivasi akun terlebih dahulu sebelum bisa dibuatkan izin.`,
        );
      }

      // Create the tanggal as a WIB date (UTC+7)
      const tanggalDate = new Date(`${input.tanggal}T00:00:00+07:00`);

      const [newPerizinan] = await ctx.db
        .insert(perizinan)
        .values({
          userId: userProfile.userId,
          tanggal: tanggalDate,
          kategoriIzin: input.kategoriIzin,
          deskripsi: input.deskripsi ?? null,
          linkFoto: input.linkFoto ?? null,
          approvalStatus: "approved",
          status: true,
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newPerizinan;
    }),

  // Mengambil satu record perizinan berdasarkan UUID primary key.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const where = hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES)
        ? eq(perizinan.id, input.id)
        : and(eq(perizinan.id, input.id), eq(perizinan.userId, ctx.user.id));

      const row = await ctx.db.query.perizinan.findFirst({
        where: where,
        with: {
          userProfile: true,
        },
      });

      return row ?? null;
    }),

  // Memperbarui status persetujuan perizinan.
  updateStatus: privilegedProcedure
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
          rejectionReason:
            input.approvalStatus === "rejected" ? input.rejectionReason : null,
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
