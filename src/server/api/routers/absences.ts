import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { absences } from "~/server/db/schema";
import { eq, and, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/**
 * Router tRPC untuk tabel `absences`.
 *
 * Fitur yang disediakan:
 *  - createManual : Buat absensi manual oleh admin
 *  - delete       : Hapus data absensi berdasarkan ID
 *  - list         : Ambil daftar absensi dengan filter (userId, status, tanggal) + pagination.
 *  - listRaw      : Ambil seluruh data absensi tanpa pagination
 *  - getById      : Ambil satu record absensi berdasarkan primary key (id).
 *
 * Catatan Implementasi:
 *  - Validasi input menggunakan Zod agar aman & terstruktur.
 *  - Filter tanggal memakai format YYYY-MM-DD (regex sederhana) sebelum dikirim ke DB.
 *  - Query list membangun array kondisi secara dinamis & hanya menerapkan WHERE jika ada filter.
 *  - Tidak ada otorisasi (auth) di sini; middleware bisa ditambahkan kemudian bila diperlukan.
 */

// Basic CRUD router for the absences table
export const absencesRouter = createTRPCRouter({
  // CREATE MANUAL: Admin input absensi manual
  createManual: protectedProcedure
    .input(
      z.object({
        nis: z.string(),
        status: z.enum(["Hadir", "Terlambat", "Pulang", "Dipulangkan"]),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
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

      // Get user_profile to find user_id (required for absences table foreign key)
      const userProfile = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.nis, siswa.nis.toString()),
      });

      if (!userProfile) {
        throw new Error(
          `Siswa ${siswa.nama ?? siswa.nis} belum memiliki akun user. ` +
          `Siswa harus aktivasi akun terlebih dahulu sebelum bisa diabsen.`,
        );
      }

      // Map incoming status to allowed values for absences.status constraint
      // DB constraint allows only: 'Hadir', 'Datang', 'Pulang'
      const mappedAbsenceStatus: "Hadir" | "Datang" | "Pulang" = (() => {
        switch (input.status) {
          case "Hadir":
            return "Hadir";
          case "Terlambat":
            return "Hadir"; // treat late arrival as Hadir in DB
          case "Pulang":
          case "Dipulangkan":
            return "Pulang"; // both map to Pulang in DB
          default:
            return "Pulang";
        }
      })();

      // Create absence record in PostgreSQL (no Supabase auth changes)
      const [newAbsence] = await ctx.db
        .insert(absences)
        .values({
          userId: userProfile.userId,
          date: input.date,
          status: mappedAbsenceStatus,
          latitude: null,
          longitude: null,
          createdAt: new Date(),
        })
        .returning();

      return newAbsence;
    }),

  // DELETE: Hapus data absensi berdasarkan ID
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if absence exists
      const absence = await ctx.db.query.absences.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      });

      if (!absence) {
        throw new Error("Data absensi tidak ditemukan");
      }

      // Delete the absence record
      const [deletedAbsence] = await ctx.db
        .delete(absences)
        .where(eq(absences.id, input.id))
        .returning();

      return deletedAbsence;
    }),

  // BULK DELETE: Hapus banyak data absensi sekaligus
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Delete multiple records in one query using OR conditions
      const deletedAbsences = await ctx.db
        .delete(absences)
        .where(or(...input.ids.map((id) => eq(absences.id, id))))
        .returning();

      return {
        deletedCount: deletedAbsences.length,
        deletedIds: deletedAbsences.map((a) => a.id),
      };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().uuid().optional(),
          // Filter by multiple user IDs (for class-based filtering)
          userIds: z.array(z.string().uuid()).optional(),
          // pagination
          limit: z.number().int().min(1).max(1500).default(20),
          offset: z.number().int().min(0).default(0),
          status: z.string().optional(),
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(), // expecting YYYY-MM-DD
          sort: z.enum(["asc", "desc"]).default("asc"),
          query: z.string().optional(), // Search query for student name
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions: (SQL | undefined)[] = [];
      if (input?.userId) conditions.push(eq(absences.userId, input.userId));
      // Support filtering by multiple userIds (for per-class attendance)
      if (input?.userIds && input.userIds.length > 0) {
        conditions.push(
          or(...input.userIds.map((id) => eq(absences.userId, id))),
        );
      }
      if (input?.status) {
        if (input.status === "Hadir") {
          // Treat 'Hadir' filter as both Hadir and legacy 'Datang'
          conditions.push(
            or(eq(absences.status, "Hadir"), eq(absences.status, "Datang")),
          );
        } else {
          conditions.push(eq(absences.status, input.status));
        }
      }
      if (input?.date) conditions.push(eq(absences.date, input.date));

      const validConds = conditions.filter(Boolean) as SQL[];
      const where = validConds.length ? and(...validConds) : undefined;

      const rows = await ctx.db.query.absences.findMany({
        where: where,
        limit: input?.limit ?? 20,
        offset: input?.offset ?? 0,
        orderBy: (absences, { desc, asc }) => [
          (input?.sort ?? "asc") === "desc"
            ? desc(absences.date)
            : asc(absences.date),
        ],
        with: {
          userProfile: true,
        },
      });

      // Filter by search query if provided (client-side filtering after fetch)
      // This is done after fetching because we need to search in userProfile.fullName
      if (input?.query && input.query.trim()) {
        const searchQuery = input.query.trim().toLowerCase();
        return rows.filter((row) => {
          const name = row.userProfile?.fullName?.toLowerCase() ?? "";
          return name.includes(searchQuery);
        });
      }

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
      z
        .object({
          days: z.number().int().min(1).max(365).default(7),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0];

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
      const dateMap: Record<
        string,
        {
          hadir: Set<string>;
          izin: Set<string>;
          terlambat: Set<string>;
        }
      > = {};

      // Initialize all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split("T")[0];
        if (dateStr) {
          dateMap[dateStr] = {
            hadir: new Set(),
            izin: new Set(),
            terlambat: new Set(),
          };
        }
      }

      // Fill in attendance data
      absencesData.forEach((a) => {
        const dateStr = a.date; // Already a string in YYYY-MM-DD format
        if (dateStr && dateMap[dateStr]) {
          if (a.status === "Terlambat") {
            dateMap[dateStr].terlambat.add(a.userId);
            dateMap[dateStr].hadir.add(a.userId); // Terlambat tetap termasuk dalam kehadiran
          } else {
            dateMap[dateStr].hadir.add(a.userId);
          }
        }
      });

      // Fill in permission data
      perizinanData.forEach((p) => {
        const dateStr = p.tanggalUtcDate;
        if (dateStr && dateMap[dateStr] && p.approvalStatus === "approved") {
          dateMap[dateStr].izin.add(p.userId);
        }
      });

      // Build result array
      const result = Object.entries(dateMap).map(([date, data]) => {
        const hadirCount = data.hadir.size;
        const izinCount = data.izin.size;
        const terlambatCount = data.terlambat.size;
        const tidakHadirCount =
          totalUsers - hadirCount - izinCount - terlambatCount;

        return {
          date,
          hadir: hadirCount,
          izin: izinCount,
          terlambat: terlambatCount,
          tidakHadir: tidakHadirCount > 0 ? tidakHadirCount : 0,
        };
      });

      return result;
    }),

  // Detailed list of students by status for a specific date
  getDetailsByStatus: protectedProcedure
    .input(
      z.object({
        status: z.enum(["present", "late", "absent", "permitted"]),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).default(() => new Date().toISOString().split("T")[0]!),
        limit: z.number().int().min(1).max(500).default(10),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // 1. Get ALL Active Students first (base set)
      const allStudents = await ctx.db.query.userProfiles.findMany({
        orderBy: (table, { asc }) => [asc(table.fullName)],
      });

      // 2. Fetch Absences for the date
      const absencesData = await ctx.db.query.absences.findMany({
        where: (table, { eq }) => eq(table.date, input.date),
        with: {
          userProfile: true,
        },
      });

      // 3. Fetch Permissions for the date
      // Filter by utc date helper column or range if needed. Using date string match for simplicity as requested.
      const perizinanData = await ctx.db.query.perizinan.findMany({
        where: (table, { eq }) => eq(table.tanggalUtcDate, input.date),
        with: {
          userProfile: true,
        },
      });

      const approvedPermissions = perizinanData.filter(p => p.approvalStatus === "approved");

      // Helper Sets
      const presentUserIds = new Set<string>();
      const lateUserIds = new Set<string>();
      const permittedUserIds = new Set<string>();

      absencesData.forEach((a) => {
        if (a.status === "Terlambat") {
          lateUserIds.add(a.userId);
          presentUserIds.add(a.userId); // Late is also technically present
        } else if (a.status === "Hadir" || a.status === "Datang") {
          presentUserIds.add(a.userId);
        }
      });

      approvedPermissions.forEach((p) => {
        permittedUserIds.add(p.userId);
      });

      // 4. Filter based on requested status
      let filteredStudents: Array<{
        id: string;
        name: string | null;
        className: string | null;
        nis: string | null;
        status: string;
        timestamp: Date | null;
      }> = [];

      if (input.status === "present") {
        filteredStudents = allStudents
          .filter((s) => presentUserIds.has(s.userId))
          .map((s) => {
            const absence = absencesData.find((a) => a.userId === s.userId);
            return {
              id: s.userId,
              name: s.fullName,
              className: s.className,
              nis: s.nis,
              status: absence?.status ?? "Hadir",
              timestamp: absence?.createdAt ?? null,
            };
          });
      } else if (input.status === "late") {
        filteredStudents = allStudents
          .filter((s) => lateUserIds.has(s.userId))
          .map((s) => {
            const absence = absencesData.find((a) => a.userId === s.userId);
            return {
              id: s.userId,
              name: s.fullName,
              className: s.className,
              nis: s.nis,
              status: "Terlambat",
              timestamp: absence?.createdAt ?? null,
            };
          });
      } else if (input.status === "permitted") {
        filteredStudents = allStudents
          .filter((s) => permittedUserIds.has(s.userId))
          .map((s) => {
            const perm = approvedPermissions.find((p) => p.userId === s.userId);
            return {
              id: s.userId,
              name: s.fullName,
              className: s.className,
              nis: s.nis,
              status: perm?.kategoriIzin ?? "Izin",
              timestamp: perm?.createdAt ?? null,
            };
          });
      } else if (input.status === "absent") {
        filteredStudents = allStudents
          .filter((s) => !presentUserIds.has(s.userId) && !permittedUserIds.has(s.userId))
          .map((s) => {
            return {
              id: s.userId,
              name: s.fullName,
              className: s.className,
              nis: s.nis,
              status: "Alpa",
              timestamp: null,
            };
          });
      }

      // Apply pagination
      const total = filteredStudents.length;
      const paginatedStudents = filteredStudents.slice(input.offset, input.offset + input.limit);

      return {
        students: paginatedStudents,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),
});

export type AbsencesRouter = typeof absencesRouter;
