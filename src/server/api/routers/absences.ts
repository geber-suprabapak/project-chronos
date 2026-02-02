import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { absences, userProfiles } from "~/server/db/schema";
import { eq, and, or, ilike, exists, gte, lte } from "drizzle-orm";
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

  // Mengambil daftar absensi dengan opsi filter & pagination.
  // Return: Array record absensi sesuai filter.
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
          // Date range filter (untuk export per kelas)
          startDate: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          endDate: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          sort: z.enum(["asc", "desc"]).default("asc"),
          // Filter by className from user_profiles (untuk fitur Absensi Per Kelas)
          className: z.string().optional(),
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

      // Date range filter (startDate - endDate)
      if (input?.startDate)
        conditions.push(gte(absences.date, input.startDate));
      if (input?.endDate) conditions.push(lte(absences.date, input.endDate));

      // Filter by className using exists subquery untuk efisiensi
      // Ini mencari absences yang userId-nya ada di user_profiles dengan className yang cocok
      if (input?.className) {
        conditions.push(
          exists(
            ctx.db
              .select({ one: userProfiles.userId })
              .from(userProfiles)
              .where(
                and(
                  eq(userProfiles.userId, absences.userId),
                  ilike(userProfiles.className, `%${input.className}%`),
                ),
              ),
          ),
        );
      }

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

  // Ringkasan kehadiran per kelas: siapa yang hadir, tidak hadir, izin, sakit
  getClassAttendanceSummary: protectedProcedure
    .input(
      z.object({
        className: z.string().min(1),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
      }),
    )
    .query(async ({ ctx, input }) => {
      // 1. Get all students in this class
      const studentsInClass = await ctx.db.query.userProfiles.findMany({
        where: (table, { ilike }) =>
          ilike(table.className, `%${input.className}%`),
        orderBy: (table, { asc }) => [asc(table.fullName)],
      });

      const studentUserIds = new Set(studentsInClass.map((s) => s.userId));
      const studentIdsArray = Array.from(studentUserIds);

      // If no students in class, short-circuit with empty summary
      if (studentIdsArray.length === 0) {
        return {
          date: input.date,
          className: input.className,
          totalStudents: 0,
          summary: {
            hadir: 0,
            terlambat: 0,
            sakit: 0,
            izin: 0,
            tidakHadir: 0,
          },
          details: {
            hadir: [],
            terlambat: [],
            sakit: [],
            izin: [],
            tidakHadir: [],
          },
        } as const;
      }

      // 2. Get absences for this class on this date (filtered in DB)
      const classAbsences = await ctx.db.query.absences.findMany({
        where: (table, { eq, inArray }) =>
          and(eq(table.date, input.date), inArray(table.userId, studentIdsArray)),
        with: {
          userProfile: true,
        },
      });

      // 3. Get perizinan for this date
      const startLocal = new Date(`${input.date}T00:00:00+07:00`);
      const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

      const perizinanOnDate = await ctx.db.query.perizinan.findMany({
        where: (table, { gte, lt, and }) =>
          and(gte(table.tanggal, startLocal), lt(table.tanggal, endLocal)),
        with: {
          userProfile: true,
        },
      });

      // Filter to only students in this class with approved status
      const classPerizinan = perizinanOnDate.filter(
        (p) =>
          p.userProfile &&
          studentUserIds.has(p.userProfile.userId) &&
          p.approvalStatus === "approved",
      );

      // 4. Categorize students
      const hadirSet = new Set<string>();
      const terlambatSet = new Set<string>();
      const sakitSet = new Set<string>();
      const izinSet = new Set<string>();

      // Process absences
      for (const a of classAbsences) {
        const userId = a.userId;
        if (a.status === "Hadir" || a.status === "Datang") {
          hadirSet.add(userId);
        } else if (a.status === "Terlambat") {
          terlambatSet.add(userId);
          hadirSet.add(userId); // Terlambat counts as hadir
        }
      }

      // Process perizinan
      for (const p of classPerizinan) {
        const userId = p.userId;
        if (p.kategoriIzin === "sakit") {
          sakitSet.add(userId);
        } else if (p.kategoriIzin === "pergi") {
          izinSet.add(userId);
        }
      }

      // 5. Calculate tidak hadir (alpha) - students not in any category
      const allAccountedFor = new Set([...hadirSet, ...sakitSet, ...izinSet]);
      const tidakHadirList = studentsInClass.filter(
        (s) => !allAccountedFor.has(s.userId),
      );

      // 6. Build detailed lists
      const getStudentDetails = (userIds: Set<string>) =>
        studentsInClass
          .filter((s) => userIds.has(s.userId))
          .map((s) => ({
            userId: s.userId,
            nis: s.nis,
            fullName: s.fullName,
            absenceNumber: s.absenceNumber,
          }));

      return {
        date: input.date,
        className: input.className,
        totalStudents: studentsInClass.length,
        summary: {
          hadir: hadirSet.size,
          terlambat: terlambatSet.size,
          sakit: sakitSet.size,
          izin: izinSet.size,
          tidakHadir: tidakHadirList.length,
        },
        details: {
          hadir: getStudentDetails(hadirSet),
          terlambat: getStudentDetails(terlambatSet),
          sakit: getStudentDetails(sakitSet),
          izin: getStudentDetails(izinSet),
          tidakHadir: tidakHadirList.map((s) => ({
            userId: s.userId,
            nis: s.nis,
            fullName: s.fullName,
            absenceNumber: s.absenceNumber,
          })),
        },
      };
    }),
});

export type AbsencesRouter = typeof absencesRouter;
