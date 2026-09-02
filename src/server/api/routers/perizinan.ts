import { z } from "zod";
import {
  createTRPCRouter,
  privilegedProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { hasRequiredRole, PRIVILEGED_ROLES } from "~/server/auth/rbac";
import { astraRequest } from "~/lib/astra/client";
import { normalizeDateOnly } from "~/lib/date-utils";
import { buildPendingLeaveRequestReset } from "~/server/api/routers/perizinan-contract";
import { buildLeaveRequestsListPath } from "~/server/api/routers/history-query";

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

function mapAstraLeaveRequestToPerizinan(lr: AstraLeaveRequest) {
  const absenceNum = lr.absence_number ? parseInt(lr.absence_number, 10) : null;

  return {
    id: lr.id,
    userId: lr.user_id,
    // Keep a date-only value across the tRPC boundary. Appending a second
    // `T00:00...` to an ISO timestamp creates Invalid Date, which downstream
    // clients can coerce to 01/01/1970.
    tanggal: normalizeDateOnly(lr.date) ?? "",
    kategoriIzin: lr.category,
    deskripsi: lr.description ?? null,
    linkFoto: lr.attachment_url ?? null,
    approvalStatus: lr.approval_status,
    status: lr.status,
    rejectionReason: lr.rejection_reason ?? null,
    rejectedAt: lr.rejected_at ? new Date(lr.rejected_at) : null,
    approvedAt:
      lr.approval_status === "approved" && lr.updated_at
        ? new Date(lr.updated_at)
        : null,
    createdAt: lr.created_at ? new Date(lr.created_at) : new Date(),
    updatedAt: lr.updated_at ? new Date(lr.updated_at) : new Date(),
    userProfile: {
      id: lr.user_id,
      userId: lr.user_id,
      fullName: lr.student_name ?? null,
      email: null,
      nis: lr.student_nis ?? null,
      className: lr.student_class ?? null,
      absenceNumber: Number.isNaN(absenceNum) ? null : absenceNum,
      avatarUrl: null,
      gender: null,
      role: "student",
      createdAt: null,
      updatedAt: null,
    },
  };
}

/**
 * Router tRPC untuk entitas `perizinan` (leave requests) yang di-route melalui Astra API contract v1.
 *
 * Endpoint:
 *  - list         : Ambil daftar perizinan dari Astra dengan filter & pagination.
 *  - listRaw      : Ambil seluruh data perizinan dari Astra.
 *  - getById      : Ambil satu record perizinan berdasarkan id UUID dari Astra.
 *  - createManual : Buat/catat perizinan manual oleh admin melalui Astra.
 *  - updateStatus : Setujui atau tolak perizinan melalui Astra API.
 */
export const perizinanRouter = createTRPCRouter({
  // Mengambil daftar perizinan dengan opsi filter & pagination dari Astra.
  list: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().trim().min(1).max(255).optional(),
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
      const leaveRequests = await astraRequest<AstraLeaveRequest[]>(
        buildLeaveRequestsListPath("leave-requests", input?.userId),
      );

      let filtered = leaveRequests;

      if (!hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES)) {
        filtered = filtered.filter((lr) => lr.user_id === ctx.user.id);
      }

      if (input?.userId) {
        filtered = filtered.filter((lr) => lr.user_id === input.userId);
      }
      if (input?.kategoriIzin) {
        filtered = filtered.filter((lr) => lr.category === input.kategoriIzin);
      }
      if (input?.approvalStatus) {
        filtered = filtered.filter(
          (lr) => lr.approval_status === input.approvalStatus,
        );
      }
      if (input?.status !== undefined) {
        filtered = filtered.filter((lr) => lr.status === input.status);
      }
      const dateParam = input?.date ?? input?.tanggal;
      if (dateParam) {
        filtered = filtered.filter(
          (lr) => normalizeDateOnly(lr.date) === dateParam,
        );
      }

      // Filter out entries created from manual absence (identified by specific keywords in description)
      filtered = filtered.filter((row) => {
        const desc = (row.description ?? "").toLowerCase();
        return desc !== "terlambat" && desc !== "dipulangkan";
      });

      filtered.sort((a, b) => {
        const dateA = normalizeDateOnly(a.date) ?? "";
        const dateB = normalizeDateOnly(b.date) ?? "";
        const dateComp = dateB.localeCompare(dateA);
        if (dateComp !== 0) return dateComp;
        const createdA = a.created_at ?? "";
        const createdB = b.created_at ?? "";
        return createdB.localeCompare(createdA);
      });

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const paged = filtered.slice(offset, offset + limit);

      return paged.map(mapAstraLeaveRequestToPerizinan);
    }),

  // Mengambil seluruh data perizinan (tanpa pagination) dari Astra.
  listRaw: protectedProcedure.query(async ({ ctx }) => {
    const leaveRequests = await astraRequest<AstraLeaveRequest[]>(
      "/v1/admin/leave-requests",
    );

    let filtered = leaveRequests;
    if (!hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES)) {
      filtered = filtered.filter((lr) => lr.user_id === ctx.user.id);
    }

    filtered = filtered.filter((row) => {
      const desc = (row.description ?? "").toLowerCase();
      return desc !== "terlambat" && desc !== "dipulangkan";
    });

    filtered.sort((a, b) => {
      const createdA = a.created_at ?? "";
      const createdB = b.created_at ?? "";
      return createdB.localeCompare(createdA);
    });

    return filtered.map(mapAstraLeaveRequestToPerizinan);
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
    .mutation(async ({ input }) => {
      const students =
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students");

      const student = students.find((candidate) => candidate.nis === input.nis);
      if (!student) {
        throw new Error(
          "Siswa dengan NIS tersebut tidak ditemukan di database",
        );
      }

      if (student.lifecycle_status !== "approved") {
        throw new Error(
          `Siswa ${student.full_name ?? student.nis} belum memiliki akun user aktif. ` +
            `Siswa harus aktivasi akun terlebih dahulu sebelum bisa dibuatkan izin.`,
        );
      }

      const created = await astraRequest<AstraLeaveRequest>(
        "/v1/admin/leave-requests",
        {
          method: "POST",
          body: JSON.stringify({
            user_id: student.user_id,
            category: input.kategoriIzin,
            description:
              input.deskripsi ??
              `Izin ${input.kategoriIzin} dicatat oleh administrator.`,
            date: input.tanggal,
            file_id: input.linkFoto,
            approval_status: "approved",
          }),
        },
      );

      const mapped = mapAstraLeaveRequestToPerizinan(created);
      if (!mapped.userProfile.fullName && student.full_name) {
        mapped.userProfile.fullName = student.full_name;
      }
      if (!mapped.userProfile.nis && student.nis) {
        mapped.userProfile.nis = student.nis;
      }
      if (!mapped.userProfile.className && student.class_name) {
        mapped.userProfile.className = student.class_name;
      }
      return mapped;
    }),

  // Mengambil satu record perizinan berdasarkan UUID primary key dari Astra.
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const lr = await astraRequest<AstraLeaveRequest>(
        `/v1/admin/leave-requests/${input.id}`,
      ).catch(() => null);

      if (!lr) return null;

      if (
        !hasRequiredRole(ctx.userRole, PRIVILEGED_ROLES) &&
        lr.user_id !== ctx.user.id
      ) {
        return null;
      }

      return mapAstraLeaveRequestToPerizinan(lr);
    }),

  // Memperbarui status persetujuan perizinan melalui Astra API.
  updateStatus: privilegedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        approvalStatus: z.enum(["approved", "rejected", "pending"]),
        rejectionReason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.approvalStatus === "pending") {
        const reset = await astraRequest<AstraLeaveRequest>(
          `/v1/admin/leave-requests/${input.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildPendingLeaveRequestReset()),
          },
        );
        return mapAstraLeaveRequestToPerizinan(reset);
      }

      if (input.approvalStatus === "approved") {
        const approved = await astraRequest<AstraLeaveRequest>(
          `/v1/admin/leave-requests/${input.id}/approve`,
          { method: "POST" },
        );
        return mapAstraLeaveRequestToPerizinan(approved);
      }

      if (input.approvalStatus === "rejected") {
        const rejected = await astraRequest<AstraLeaveRequest>(
          `/v1/admin/leave-requests/${input.id}/reject`,
          {
            method: "POST",
            body: JSON.stringify({
              reason: input.rejectionReason ?? "Ditolak oleh administrator.",
            }),
          },
        );
        return mapAstraLeaveRequestToPerizinan(rejected);
      }

      const current = await astraRequest<AstraLeaveRequest>(
        `/v1/admin/leave-requests/${input.id}`,
      );
      return mapAstraLeaveRequestToPerizinan(current);
    }),
});

export type PerizinanRouter = typeof perizinanRouter;
