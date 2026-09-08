import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import {
  actionableAttendanceBlockedMessage,
  AstraRequestError,
  astraRequest,
} from "~/lib/astra/client";
import { normalizeStudentRows } from "~/lib/class-names";
import { normalizeDateOnly } from "~/lib/date-utils";
import {
  fetchAllAttendanceRecords,
  fetchAttendanceRecordById,
} from "~/server/api/routers/attendance-source";

interface AstraStudentProfile {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  gender?: string | null;
}

interface AstraAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: "Hadir" | "Terlambat" | "Pulang" | "Alpha" | "Datang";
  action_type?: "check_in" | "check_out" | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
}

interface AstraLeaveRequest {
  id: string;
  user_id: string;
  student_name?: string | null;
  student_nis?: string | null;
  student_class?: string | null;
  absence_number?: string | null;
  category: "sakit" | "pergi" | "dispensasi" | "lainnya";
  description?: string | null;
  status: boolean;
  date: string;
  approval_status: "approved" | "rejected" | "pending";
  attachment_url?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function normalizeAttendanceDate(value: string): string {
  return normalizeDateOnly(value) ?? "";
}

function mapStudentsByUserId(
  students: AstraStudentProfile[] | null | undefined,
): Map<string, AstraStudentProfile> {
  return new Map<string, AstraStudentProfile>(
    normalizeStudentRows(students)
      .filter(
        (student): student is typeof student & { user_id: string } =>
          student.user_id !== null,
      )
      .map((student) => [student.user_id, student]),
  );
}

function mapAstraAttendance(
  att: AstraAttendanceRecord,
  studentMap?: Map<string, AstraStudentProfile>,
) {
  const student = studentMap?.get(att.user_id);
  const normalizedStatus = att.status === "Datang" ? "Hadir" : att.status;
  const actionType =
    att.action_type ?? (att.status === "Datang" ? "check_in" : null);

  return {
    id: att.id,
    userId: att.user_id,
    date: normalizeAttendanceDate(att.date),
    // SAFETY: normalizedStatus is guaranteed to be a valid AstraAttendanceRecord status after mapping legacy Datang to Hadir.
    status: normalizedStatus as AstraAttendanceRecord["status"],
    actionType,
    latitude: att.latitude ?? null,
    longitude: att.longitude ?? null,
    createdAt: att.created_at ? new Date(att.created_at) : new Date(),
    userProfile: student
      ? {
          id: student.user_id,
          userId: student.user_id,
          fullName: student.full_name ?? null,
          email: student.email ?? null,
          nis: student.nis ?? null,
          className: student.class_name ?? null,
          absenceNumber: student.absence_number ?? null,
          avatarUrl: student.avatar_url ?? null,
          gender: student.gender ?? null,
          role: student.role ?? "student",
          createdAt: null,
          updatedAt: null,
        }
      : null,
  };
}

/**
 * Router tRPC untuk tabel `absences` yang di-route melalui Astra API contract v1.
 *
 * Fitur yang disediakan:
 *  - createManual : Buat absensi manual oleh admin melalui Astra
 *  - delete       : Hapus data absensi berdasarkan ID
 *  - bulkDelete   : Hapus banyak data absensi sekaligus
 *  - list         : Ambil daftar absensi dengan filter (userId, status, tanggal) + pagination
 *  - listRaw      : Ambil seluruh data absensi tanpa pagination
 *  - getById      : Ambil satu record absensi berdasarkan primary key (id)
 *  - getAttendanceStats: Statistik kehadiran untuk dashboard dengan range waktu
 *  - getTodaySummary: Ringkasan dashboard harian
 *  - getClassAttendanceSummary: Ringkasan kehadiran per kelas
 */
export const absencesRouter = createTRPCRouter({
  // CREATE MANUAL: Admin input absensi manual
  createManual: adminProcedure
    .input(
      z.object({
        nis: z.string(),
        status: z.enum(["Hadir", "Terlambat", "Pulang", "Dipulangkan"]),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
      }),
    )
    .mutation(async ({ input }) => {
      const students =
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students");
      const student = students.find((candidate) => candidate.nis === input.nis);
      if (!student) {
        throw new Error("Siswa dengan NIS tersebut tidak ditemukan di Astra.");
      }

      const statusAndAction = (() => {
        switch (input.status) {
          case "Hadir":
            return {
              // SAFETY: Explicit literal type for status contract.
              status: "Hadir" as const,
              // SAFETY: Explicit literal type for action_type contract.
              action_type: "check_in" as const,
            };
          case "Terlambat":
            return {
              // SAFETY: Explicit literal type for status contract.
              status: "Terlambat" as const,
              // SAFETY: Explicit literal type for action_type contract.
              action_type: "check_in" as const,
            };
          case "Pulang":
          case "Dipulangkan":
            return {
              // SAFETY: Explicit literal type for status contract.
              status: "Pulang" as const,
              // SAFETY: Explicit literal type for action_type contract.
              action_type: "check_out" as const,
            };
        }
      })();

      try {
        return await astraRequest("/v1/admin/attendance/manual", {
          method: "POST",
          body: JSON.stringify({
            user_id: student.user_id,
            status: statusAndAction.status,
            action_type: statusAndAction.action_type,
            date: input.date,
            reason: "Manual attendance recorded by Chronos administrator.",
          }),
        });
      } catch (error) {
        if (
          error instanceof AstraRequestError &&
          error.code === "ATTENDANCE_BLOCKED"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: actionableAttendanceBlockedMessage(error),
            cause: error,
          });
        }
        throw error;
      }
    }),

  // DELETE: Hapus data absensi berdasarkan ID
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await astraRequest<{ id?: string }>(
        `/v1/admin/attendance/${input.id}`,
        { method: "DELETE" },
      );
      return { id: deleted.id ?? input.id };
    }),

  // BULK DELETE: Hapus banyak data absensi sekaligus
  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }))
    .mutation(async ({ input }) => {
      return astraRequest<{ deletedCount: number; deletedIds: string[] }>(
        "/v1/admin/attendance/bulk",
        {
          method: "DELETE",
          body: JSON.stringify({ ids: input.ids }),
        },
      );
    }),

  // Mengambil daftar absensi dengan opsi filter & pagination dari Astra.
  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().trim().min(1).max(255).optional(),
          userIds: z.array(z.string().trim().min(1).max(255)).optional(),
          limit: z.number().int().min(1).max(1500).default(20),
          offset: z.number().int().min(0).default(0),
          status: z.string().optional(),
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          startDate: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          endDate: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
          sort: z.enum(["asc", "desc"]).default("asc"),
          query: z.string().trim().min(1).optional(),
          className: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const [attendances, students] = await Promise.all([
        fetchAllAttendanceRecords<AstraAttendanceRecord>({
          userId: input?.userId,
          date: input?.date,
          startDate: input?.startDate,
          endDate: input?.endDate,
        }),
        astraRequest<AstraStudentProfile[]>("/v1/admin/students").catch(
          () => null,
        ),
      ]);

      const studentMap = mapStudentsByUserId(students);

      let filtered = attendances;

      if (input?.userId) {
        filtered = filtered.filter((a) => a.user_id === input.userId);
      }

      if (input?.userIds && input.userIds.length > 0) {
        const idSet = new Set(input.userIds);
        filtered = filtered.filter((a) => idSet.has(a.user_id));
      }

      if (input?.status) {
        if (input.status === "Hadir" || input.status === "Datang") {
          filtered = filtered.filter(
            (a) => a.status === "Hadir" || a.status === "Datang",
          );
        } else {
          filtered = filtered.filter((a) => a.status === input.status);
        }
      }

      if (input?.date) {
        filtered = filtered.filter(
          (a) => normalizeAttendanceDate(a.date) === input.date,
        );
      }

      if (input?.startDate) {
        filtered = filtered.filter(
          (a) => normalizeAttendanceDate(a.date) >= input.startDate!,
        );
      }

      if (input?.endDate) {
        filtered = filtered.filter(
          (a) => normalizeAttendanceDate(a.date) <= input.endDate!,
        );
      }

      if (input?.query) {
        const queryLower = input.query.toLowerCase();
        filtered = filtered.filter((a) => {
          const student = studentMap.get(a.user_id);
          if (!student) return false;
          const nameMatch = (student.full_name ?? "")
            .toLowerCase()
            .includes(queryLower);
          const emailMatch = (student.email ?? "")
            .toLowerCase()
            .includes(queryLower);
          const nisMatch = (student.nis ?? "")
            .toLowerCase()
            .includes(queryLower);
          return nameMatch || emailMatch || nisMatch;
        });
      }

      if (input?.className) {
        const classLower = input.className.toLowerCase();
        filtered = filtered.filter((a) => {
          const student = studentMap.get(a.user_id);
          return (student?.class_name ?? "").toLowerCase().includes(classLower);
        });
      }

      filtered.sort((a, b) => {
        const dateA = normalizeAttendanceDate(a.date);
        const dateB = normalizeAttendanceDate(b.date);
        const dateComp =
          input?.sort === "desc"
            ? dateB.localeCompare(dateA)
            : dateA.localeCompare(dateB);
        if (dateComp !== 0) return dateComp;
        const timeA = a.created_at ?? "";
        const timeB = b.created_at ?? "";
        const timeComp =
          input?.sort === "desc"
            ? timeB.localeCompare(timeA)
            : timeA.localeCompare(timeB);
        if (timeComp !== 0) return timeComp;
        return input?.sort === "desc"
          ? b.id.localeCompare(a.id)
          : a.id.localeCompare(b.id);
      });

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const paged = filtered.slice(offset, offset + limit);
      const hasMore = offset + paged.length < filtered.length;

      return {
        rows: paged.map((a) => mapAstraAttendance(a, studentMap)),
        total: filtered.length,
        limit,
        offset,
        hasMore,
      };
    }),

  // Mengambil seluruh data absensi (tanpa pagination) dari Astra.
  listRaw: protectedProcedure.query(async () => {
    const [attendances, students] = await Promise.all([
      fetchAllAttendanceRecords<AstraAttendanceRecord>(),
      astraRequest<AstraStudentProfile[]>("/v1/admin/students").catch(
        () => null,
      ),
    ]);

    const studentMap = mapStudentsByUserId(students);

    const sorted = [...attendances].sort((a, b) => {
      const dateA = normalizeAttendanceDate(a.date);
      const dateB = normalizeAttendanceDate(b.date);
      const dateComp = dateB.localeCompare(dateA);
      if (dateComp !== 0) return dateComp;
      const timeA = a.created_at ?? "";
      const timeB = b.created_at ?? "";
      const timeComp = timeB.localeCompare(timeA);
      if (timeComp !== 0) return timeComp;
      return b.id.localeCompare(a.id);
    });

    return sorted.map((a) => mapAstraAttendance(a, studentMap));
  }),

  // Mengambil satu record berdasarkan ID (primary key). Return null jika tidak ditemukan.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [record, students] = await Promise.all([
        fetchAttendanceRecordById<AstraAttendanceRecord>(input.id),
        astraRequest<AstraStudentProfile[]>("/v1/admin/students").catch(
          () => [],
        ),
      ]);

      if (!record) return null;

      const studentMap = mapStudentsByUserId(students);

      return mapAstraAttendance(record, studentMap);
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
    .query(async ({ input }) => {
      const days = input?.days ?? 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0]!;

      let students: AstraStudentProfile[];
      let attendances: AstraAttendanceRecord[];
      let leaveRequests: AstraLeaveRequest[];
      try {
        [students, attendances, leaveRequests] = await Promise.all([
          astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
          fetchAllAttendanceRecords<AstraAttendanceRecord>({
            startDate: startDateStr,
          }),
          astraRequest<AstraLeaveRequest[]>("/v1/admin/leave-requests"),
        ]);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memuat statistik kehadiran dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }

      const normalizedStudents = normalizeStudentRows(students);
      const totalUsers = normalizedStudents.length;

      const dateMap: Record<
        string,
        {
          hadir: Set<string>;
          izin: Set<string>;
          terlambat: Set<string>;
        }
      > = {};

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

      // 1. Process approved leave requests first (ADR-002 precedence rule)
      leaveRequests
        .filter(
          (p) =>
            (normalizeDateOnly(p.date) ?? "") >= startDateStr &&
            (p.approval_status === "approved" || p.status === true),
        )
        .forEach((p) => {
          const dateStr = normalizeDateOnly(p.date) ?? "";
          if (dateStr && dateMap[dateStr]) {
            dateMap[dateStr].izin.add(p.user_id);
          }
        });

      // 2. Process attendance records with disjoint sets, leave precedence, and Pulang/Alpha exclusion
      attendances
        .filter((a) => normalizeAttendanceDate(a.date) >= startDateStr)
        .forEach((a) => {
          const dateStr = normalizeAttendanceDate(a.date);
          if (dateStr && dateMap[dateStr]) {
            // Precedence: Approved leave overrides physical attendance records
            if (dateMap[dateStr].izin.has(a.user_id)) {
              return;
            }

            if (a.status === "Terlambat") {
              dateMap[dateStr].hadir.delete(a.user_id);
              dateMap[dateStr].terlambat.add(a.user_id);
            } else if (a.status === "Hadir" || a.status === "Datang") {
              if (!dateMap[dateStr].terlambat.has(a.user_id)) {
                dateMap[dateStr].hadir.add(a.user_id);
              }
            }
            // Note: Pulang and Alpha records are strictly excluded from presence sets
          }
        });

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

  // Ringkasan dashboard harian untuk menghindari query raw besar di client.
  getTodaySummary: protectedProcedure
    .input(
      z
        .object({
          date: z
            .string()
            .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const date = input?.date ?? new Date().toISOString().split("T")[0]!;

      let students: AstraStudentProfile[];
      let attendances: AstraAttendanceRecord[];
      let leaveRequests: AstraLeaveRequest[];
      try {
        [students, attendances, leaveRequests] = await Promise.all([
          astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
          fetchAllAttendanceRecords<AstraAttendanceRecord>({ date }),
          astraRequest<AstraLeaveRequest[]>("/v1/admin/leave-requests"),
        ]);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memuat ringkasan harian absensi dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }

      const totalUsers = students.length;
      const masukUserIds = new Set<string>();
      const pulangUserIds = new Set<string>();
      const izinUserIds = new Set<string>();
      let izin = 0;
      let sakit = 0;

      // 1. Process leave requests first to establish precedence and category counts
      leaveRequests
        .filter(
          (row) =>
            normalizeDateOnly(row.date) === date &&
            (row.approval_status === "approved" || row.status === true),
        )
        .forEach((row) => {
          izinUserIds.add(row.user_id);
          if (row.category === "sakit") {
            sakit += 1;
          } else {
            // Count pergi, dispensasi, lainnya under izin
            izin += 1;
          }
        });

      // 2. Process attendance rows, respecting leave precedence
      attendances
        .filter((row) => normalizeAttendanceDate(row.date) === date)
        .forEach((row) => {
          if (row.status === "Pulang") {
            pulangUserIds.add(row.user_id);
          }
          // Approved leave overrides physical check-in for daily state
          if (izinUserIds.has(row.user_id)) {
            return;
          }
          if (
            row.status === "Hadir" ||
            row.status === "Datang" ||
            row.status === "Terlambat"
          ) {
            masukUserIds.add(row.user_id);
          }
        });

      const hadirAtauIzin = new Set<string>([...masukUserIds, ...izinUserIds]);
      const sudahAbsenPulang = Array.from(masukUserIds).filter((userId) =>
        pulangUserIds.has(userId),
      ).length;
      const belumAbsenPulang = Array.from(masukUserIds).filter(
        (userId) => !pulangUserIds.has(userId),
      ).length;

      return {
        date,
        totalUsers,
        sudahAbsenMasuk: masukUserIds.size,
        belumAbsenMasuk: Math.max(0, totalUsers - hadirAtauIzin.size),
        sudahAbsenPulang,
        belumAbsenPulang,
        izin,
        sakit,
      };
    }),

  // Ringkasan kehadiran per kelas: siapa yang hadir, tidak hadir, izin, sakit
  getClassAttendanceSummary: protectedProcedure
    .input(
      z.object({
        className: z.string().min(1),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
      }),
    )
    .query(async ({ input }) => {
      let studentPayload: AstraStudentProfile[];
      let attendances: AstraAttendanceRecord[];
      let leaveRequests: AstraLeaveRequest[];
      try {
        [studentPayload, attendances, leaveRequests] = await Promise.all([
          astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
          fetchAllAttendanceRecords<AstraAttendanceRecord>({
            date: input.date,
          }),
          astraRequest<AstraLeaveRequest[]>("/v1/admin/leave-requests"),
        ]);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memuat ringkasan absensi kelas dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }

      const allStudents = normalizeStudentRows(studentPayload);

      const classQuery = input.className.toLowerCase();
      const studentsInClass = allStudents
        .filter((s): s is typeof s & { user_id: string } => s.user_id !== null)
        .filter((s) => (s.class_name ?? "").toLowerCase().includes(classQuery))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

      const studentUserIds = new Set(studentsInClass.map((s) => s.user_id));

      if (studentsInClass.length === 0) {
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
        };
      }

      const classAbsences = attendances.filter(
        (a) =>
          normalizeAttendanceDate(a.date) === input.date &&
          studentUserIds.has(a.user_id),
      );

      const classPerizinan = leaveRequests.filter(
        (p) =>
          normalizeDateOnly(p.date) === input.date &&
          studentUserIds.has(p.user_id) &&
          (p.approval_status === "approved" || p.status === true),
      );

      const hadirSet = new Set<string>();
      const terlambatSet = new Set<string>();
      const sakitSet = new Set<string>();
      const izinSet = new Set<string>();

      // 1. Process approved leave requests first (ADR-002 precedence rule)
      for (const p of classPerizinan) {
        const userId = p.user_id;
        if (p.category === "sakit") {
          sakitSet.add(userId);
        } else {
          izinSet.add(userId);
        }
      }

      // 2. Process attendance records with disjoint sets, leave precedence, and no double-counting
      for (const a of classAbsences) {
        const userId = a.user_id;
        // Leave precedence: students with approved leave are already in sakitSet or izinSet
        if (sakitSet.has(userId) || izinSet.has(userId)) {
          continue;
        }

        if (a.status === "Terlambat") {
          hadirSet.delete(userId);
          terlambatSet.add(userId);
        } else if (a.status === "Hadir" || a.status === "Datang") {
          if (!terlambatSet.has(userId)) {
            hadirSet.add(userId);
          }
        }
        // Pulang and Alpha rows are excluded from presence sets
      }

      // 3. Union of all accounted for students includes terlambatSet
      const allAccountedFor = new Set([
        ...hadirSet,
        ...terlambatSet,
        ...sakitSet,
        ...izinSet,
      ]);
      const tidakHadirList = studentsInClass.filter(
        (s) => !allAccountedFor.has(s.user_id),
      );

      const getStudentDetails = (userIds: Set<string>) =>
        studentsInClass
          .filter((s) => userIds.has(s.user_id))
          .map((s) => ({
            userId: s.user_id,
            nis: s.nis ?? null,
            fullName: s.full_name ?? null,
            absenceNumber: s.absence_number ?? null,
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
            userId: s.user_id,
            nis: s.nis ?? null,
            fullName: s.full_name ?? null,
            absenceNumber: s.absence_number ?? null,
          })),
        },
      };
    }),
});

export type AbsencesRouter = typeof absencesRouter;
