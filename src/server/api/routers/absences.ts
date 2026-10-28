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
import {
  isDateOnlyValue,
  normalizeDateOnly,
  schoolDate,
} from "~/lib/date-utils";
import {
  getDailyAttendanceSummary,
  getClassAttendanceSummary,
} from "~/server/attendance/daily-summary";
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

interface AstraAttendanceAttempt {
  id: string;
  user_id: string;
  action_type: "check_in" | "check_out";
  status: "success" | "failed" | "error";
  reason?: string | null;
  created_at: string;
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
  listManualAttempts: adminProcedure
    .input(
      z.object({
        nis: z.string().min(1),
        actionType: z.enum(["check_in", "check_out"]),
      }),
    )
    .query(async ({ input }) => {
      const students =
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students");
      const student = students.find((candidate) => candidate.nis === input.nis);
      if (!student) return [];

      // shortcut: each status is capped at 100; add date-filtered paging if older attempts must be selectable.
      const attemptsByStatus = await Promise.all(
        (["failed", "error"] as const).map((status) => {
          const query = new URLSearchParams({
            user_id: student.user_id,
            action_type: input.actionType,
            status,
            limit: "100",
          });
          return astraRequest<AstraAttendanceAttempt[]>(
            `/v1/admin/attendance/attempts?${query.toString()}`,
          );
        }),
      );
      return attemptsByStatus
        .flat()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 100);
    }),
  // CREATE MANUAL: Admin input absensi manual
  createManual: adminProcedure
    .input(
      z.object({
        nis: z.string(),
        status: z.enum(["Hadir", "Terlambat", "Pulang", "Dipulangkan"]),
        date: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/), // YYYY-MM-DD
        reason: z.string().trim().min(3).max(500),
        attemptId: z.string().min(1),
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
            reason: input.reason,
            attempt_id: input.attemptId,
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
      const date = input?.date ?? schoolDate();
      try {
        return await getDailyAttendanceSummary(date);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof AstraRequestError && error.status === 429) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Layanan absensi sedang sibuk. Coba lagi beberapa saat.",
            cause: error,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memuat ringkasan harian absensi dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),

  // Ringkasan kehadiran per kelas: siapa yang hadir, tidak hadir, izin, sakit
  getClassAttendanceSummary: protectedProcedure
    .input(
      z.object({
        className: z.string().trim().min(1),
        date: z.string().refine(isDateOnlyValue),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await getClassAttendanceSummary(input);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof AstraRequestError && error.status === 429) {
          throw new TRPCError({
            code: "SERVICE_UNAVAILABLE",
            message: "Layanan absensi sedang sibuk. Coba lagi beberapa saat.",
            cause: error,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memuat ringkasan absensi kelas dari layanan Astra: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),
});

export type AbsencesRouter = typeof absencesRouter;
