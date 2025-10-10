import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { absences, perizinan } from "~/server/db/schema";
import { eq, and, or } from "drizzle-orm";
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

/**
 * Helper function to calculate late status based on schedule
 * Logic: Siswa terlambat jika absen SETELAH mulaiMasuk tapi DALAM periode kompensasi
 * 
 * Contoh: mulaiMasuk=07:00, kompensasi=15 menit
 * - Absen 06:30-07:00 → Tepat waktu ✅
 * - Absen 07:01-07:15 → Terlambat ⚠️ (dalam periode kompensasi)
 * - Absen 07:16+ → Sangat terlambat ❌
 */
function calculateLateStatus(
  createdAt: Date,
  mulaiMasuk: string,
  kompensasiWaktu: number
): { isLate: boolean; lateMinutes: number } {
  // Parse waktu check-in
  const checkInHour = createdAt.getHours();
  const checkInMinute = createdAt.getMinutes();
  const checkInTotalMinutes = checkInHour * 60 + checkInMinute;

  // Parse mulai masuk (HH:MM:SS format)
  const [startHour, startMinute] = mulaiMasuk.split(':').map(Number);
  const startTotalMinutes = (startHour ?? 0) * 60 + (startMinute ?? 0);

  // Batas akhir toleransi = mulaiMasuk + kompensasi
  const maxAllowedMinutes = startTotalMinutes + kompensasiWaktu;

  // Jika check-in SETELAH mulaiMasuk tapi DALAM periode kompensasi
  if (checkInTotalMinutes > startTotalMinutes && checkInTotalMinutes <= maxAllowedMinutes) {
    return {
      isLate: true,
      lateMinutes: checkInTotalMinutes - startTotalMinutes,
    };
  }

  return {
    isLate: false,
    lateMinutes: 0,
  };
}

// Basic CRUD router for the absences table
export const absencesRouter = createTRPCRouter({
  // CREATE MANUAL: Admin input absensi manual
  createManual: protectedProcedure
    .input(
      z
        .object({
          nis: z.string(),
          status: z.enum(["Hadir", "Terlambat", "Pulang", "Dipulangkan"]),
          date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
          reason: z.string().optional(),
          lateMinutes: z.number().int().min(1).max(120).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
        .refine(
          (val) => (val.status === "Terlambat" ? typeof val.lateMinutes === "number" : true),
          {
            message: "lateMinutes wajib diisi saat status Terlambat",
            path: ["lateMinutes"],
          },
        )
    )
    .mutation(async ({ ctx, input }) => {
      // Get siswa from biodata_siswa by NIS
      const siswa = await ctx.db.query.biodataSiswa.findFirst({
        where: (table, { eq }) => eq(table.nis, BigInt(input.nis)),
      });

      if (!siswa) {
        throw new Error("Siswa dengan NIS tersebut tidak ditemukan di database");
      }

      // Get user_profile to find user_id (required for absences table foreign key)
      const userProfile = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.nis, siswa.nis.toString()),
      });

      if (!userProfile) {
        throw new Error(
          `Siswa ${siswa.nama ?? siswa.nis} belum memiliki akun user. ` +
          `Siswa harus aktivasi akun terlebih dahulu sebelum bisa diabsen.`
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
      // Build reason with stable keywords for UI
      const baseReason = (input.reason ?? "").trim();

      // Try to fetch active location to avoid empty location; used for both absence and description
      const activeLocation = await ctx.db.query.location.findFirst({
        where: (t, { eq }) => eq(t.isActive, true),
      });
      const latFromLocation = activeLocation?.latitude;
      const lonFromLocation = activeLocation?.longitude;
      // Prefer provided coords from client; fallback to active location
      const latToSave = typeof input.latitude === "number" ? input.latitude : latFromLocation;
      const lonToSave = typeof input.longitude === "number" ? input.longitude : lonFromLocation;

      const reasonWithKeyword = input.status === "Terlambat"
        ? `Terlambat${input.lateMinutes ? ` ${input.lateMinutes} menit` : ""}${baseReason ? ` — ${baseReason}` : ""}`
        : input.status === "Dipulangkan"
          ? `Dipulangkan${baseReason ? ` — ${baseReason}` : ""}`
          : baseReason || `Absen manual oleh admin - ${input.status}`;

      const [newAbsence] = await ctx.db
        .insert(absences)
        .values({
          userId: userProfile.userId,
          date: input.date,
          status: mappedAbsenceStatus,
          reason: reasonWithKeyword,
          latitude: latToSave,
          longitude: lonToSave,
          createdAt: new Date(),
          // Note: latitude, longitude will be null for manual entries
        })
        .returning();

      // Also create a perizinan record to mirror the manual entry without changing schema
      // perizinan.kategori_izin is constrained to ('sakit','pergi')
      const kategoriIzin: "sakit" | "pergi" = "pergi";
      await ctx.db.insert(perizinan).values({
        userId: userProfile.userId,
        // tanggal expects timestamptz; use midnight of provided date in local time
        // If you prefer UTC midnight, consider `${input.date}T00:00:00Z`
        tanggal: new Date(input.date),
        kategoriIzin,
        deskripsi: reasonWithKeyword,
        // approvalStatus defaults to 'pending', status boolean defaults to false
      });

      return newAbsence;
    }),

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
      const conditions: (SQL | undefined)[] = [];
      if (input?.userId) conditions.push(eq(absences.userId, input.userId));
      if (input?.status) {
        if (input.status === "Hadir") {
          // Treat 'Hadir' filter as both Hadir and legacy 'Datang'
          conditions.push(or(eq(absences.status, "Hadir"), eq(absences.status, "Datang")));
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
          (input?.sort ?? "asc") === "desc" ? desc(absences.date) : asc(absences.date)
        ],
        with: {
          userProfile: true,
        },
      });

      // Get all schedules to calculate late status
      const schedules = await ctx.db.query.jadwalAbsensi.findMany();
      const scheduleMap = new Map(schedules.map(s => [s.hari.toLowerCase(), s]));

      // Day mapping: 0=minggu, 1=senin, etc.
      const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

      // Enrich rows with late status calculation
      const enrichedRows = rows.map(row => {
        // Only calculate for "Datang" or "Hadir" status (arrival time)
        if (row.status !== "Datang" && row.status !== "Hadir") {
          return { ...row, isLate: false, lateMinutes: 0 };
        }

        // Get day of week from the date
        const absenceDate = new Date(row.date);
        const dayOfWeek = absenceDate.getDay();
        const dayName = dayNames[dayOfWeek];

        // Get schedule for this day
        const schedule = scheduleMap.get(dayName ?? "");
        if (!schedule?.isActive) {
          return { ...row, isLate: false, lateMinutes: 0 };
        }

        // Calculate late status
        const lateStatus = calculateLateStatus(
          row.createdAt,
          schedule.mulaiMasuk,
          schedule.kompensasiWaktu
        );

        return {
          ...row,
          isLate: lateStatus.isLate,
          lateMinutes: lateStatus.lateMinutes,
        };
      });

      return enrichedRows;
    }),

  // Mengambil seluruh data absensi (tanpa pagination) - gunakan hati-hati untuk dataset besar.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.absences.findMany({
      orderBy: (absences, { desc }) => [desc(absences.date)],
      with: {
        userProfile: true,
      },
    });

    // Get all schedules to calculate late status
    const schedules = await ctx.db.query.jadwalAbsensi.findMany();
    const scheduleMap = new Map(schedules.map(s => [s.hari.toLowerCase(), s]));

    // Day mapping: 0=minggu, 1=senin, etc.
    const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

    // Enrich rows with late status calculation
    const enrichedRows = rows.map(row => {
      // Only calculate for "Datang" or "Hadir" status (arrival time)
      if (row.status !== "Datang" && row.status !== "Hadir") {
        return { ...row, isLate: false, lateMinutes: 0 };
      }

      // Get day of week from the date
      const absenceDate = new Date(row.date);
      const dayOfWeek = absenceDate.getDay();
      const dayName = dayNames[dayOfWeek];

      // Get schedule for this day
      const schedule = scheduleMap.get(dayName ?? "");
      if (!schedule?.isActive) {
        return { ...row, isLate: false, lateMinutes: 0 };
      }

      // Calculate late status
      const lateStatus = calculateLateStatus(
        row.createdAt,
        schedule.mulaiMasuk,
        schedule.kompensasiWaktu
      );

      return {
        ...row,
        isLate: lateStatus.isLate,
        lateMinutes: lateStatus.lateMinutes,
      };
    });

    return enrichedRows;
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

      if (!row) return null;

      // Calculate late status for this record
      if (row.status !== "Datang" && row.status !== "Hadir") {
        return { ...row, isLate: false, lateMinutes: 0 };
      }

      // Get day of week from the date
      const absenceDate = new Date(row.date);
      const dayOfWeek = absenceDate.getDay();
      const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
      const dayName = dayNames[dayOfWeek];

      // Get schedule for this day
      const schedule = await ctx.db.query.jadwalAbsensi.findFirst({
        where: (table, { eq }) => eq(table.hari, dayName ?? ""),
      });

      if (!schedule?.isActive) {
        return { ...row, isLate: false, lateMinutes: 0 };
      }

      // Calculate late status
      const lateStatus = calculateLateStatus(
        row.createdAt,
        schedule.mulaiMasuk,
        schedule.kompensasiWaktu
      );

      return {
        ...row,
        isLate: lateStatus.isLate,
        lateMinutes: lateStatus.lateMinutes,
      };
    }),
});

export type AbsencesRouter = typeof absencesRouter;
