import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  createTRPCRouter,
  privilegedProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { astraRequest, AstraRequestError } from "~/lib/astra/client";
import { collectUniqueClassNames } from "~/lib/class-names";
import {
  PROFILE_DETAIL_NOT_FOUND_SIGNAL,
  classifyProfileDetailFailures,
  isProfileDetailNotFound,
  profileDetailSeamCode,
  type AstraUpstreamFailure,
} from "~/server/api/routers/user-profiles-detail";

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

interface AstraStaffProfile {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: string[];
  gender?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

interface AstraClassItem {
  id?: string;
  name: string;
  grade?: number | null;
}

function toStudentProfile(student: AstraStudentProfile) {
  return {
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
  };
}

function toStaffProfile(staff: AstraStaffProfile) {
  return {
    id: staff.user_id,
    userId: staff.user_id,
    fullName: staff.full_name ?? null,
    email: staff.email ?? null,
    nis: null,
    className: null,
    absenceNumber: null,
    avatarUrl: null,
    gender: staff.gender ?? null,
    role: staff.role ?? staff.roles?.[0] ?? "staff",
    createdAt: staff.created_at ?? null,
    updatedAt: staff.updated_at ?? null,
  };
}

/**
 * Throws the classified profile-detail failure as a tRPC error. The upstream
 * error stays attached as `cause`, keeping status/correlation information
 * internal to the established error envelope; the client-visible message is
 * the fixed, existence-safe string for the outcome class.
 */
function failProfileDetail(
  failures: readonly (AstraUpstreamFailure | null)[],
  cause?: AstraRequestError,
): never {
  const failure = classifyProfileDetailFailures(failures);
  throw new TRPCError({
    code: profileDetailSeamCode(failure),
    message: failure.message,
    cause,
  });
}

/**
 * Profile queries backed by Astra API contract boundary.
 */
export const userProfilesRouter = createTRPCRouter({
  // GET ME: Ambil profil user yang sedang login berdasarkan OIDC token melalui Astra
  getMe: protectedProcedure.query(async () => {
    try {
      const profile =
        await astraRequest<AstraStudentProfile>("/v1/mobile/profile");
      if (!profile) return null;
      return {
        id: profile.user_id,
        userId: profile.user_id,
        fullName: profile.full_name ?? null,
        email: profile.email ?? null,
        nis: profile.nis ?? null,
        className: profile.class_name ?? null,
        absenceNumber: profile.absence_number ?? null,
        avatarUrl: profile.avatar_url ?? null,
        gender: profile.gender ?? null,
        role: profile.role ?? null,
        createdAt: null,
        updatedAt: null,
      };
    } catch {
      return null;
    }
  }),

  // GET BY ID: Ambil profil berdasarkan user_id dari Astra
  //
  // Failure mapping: hanya 404 yang meneruskan pencarian ke koleksi staff.
  // 403, timeout/network, dan 5xx adalah kegagalan dependensi/otorisasi yang
  // dilempar sebagai error tRPC terklasifikasi (recoverable untuk 5xx/timeout,
  // forbidden untuk 403) — bukan `null`, agar UI tidak menyajikan kegagalan
  // dependensi sebagai "profil tidak ditemukan" dan tidak membedah keberadaan
  // profil terproteksi lewat koleksi lain saat 403.
  getById: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const failures: (AstraUpstreamFailure | null)[] = [];
      let upstreamCause: AstraRequestError | undefined;
      let student: AstraStudentProfile | null | undefined;
      try {
        student = await astraRequest<AstraStudentProfile>(
          `/v1/admin/students/${input.id}`,
        );
      } catch (error) {
        const upstream = error instanceof AstraRequestError ? error : null;
        if (upstream) upstreamCause = upstream;
        failures.push(upstream);
        if (!isProfileDetailNotFound(upstream)) {
          failProfileDetail(failures, upstreamCause);
        }
      }

      if (student) {
        return toStudentProfile(student);
      }

      let staff: AstraStaffProfile | null | undefined;
      try {
        staff = await astraRequest<AstraStaffProfile>(
          `/v1/admin/staff/${input.id}`,
        );
      } catch (error) {
        const upstream = error instanceof AstraRequestError ? error : null;
        upstreamCause ??= upstream ?? undefined;
        failures.push(upstream);
        failProfileDetail(failures, upstreamCause);
      }

      if (staff) {
        return toStaffProfile(staff);
      }

      if (student === undefined || staff === undefined) {
        // The collection answered successfully without a payload; treat the
        // missing payload as a not-found signal for the seam matrix.
        failures.push(PROFILE_DETAIL_NOT_FOUND_SIGNAL);
      }

      failProfileDetail(failures, upstreamCause);
    }),

  // LIST: ambil daftar user_profiles dengan pagination sederhana dari Astra
  list: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          name: z.string().min(1).max(255).optional(),
          className: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const isAllJurusan = !input?.className || input.className === "ALL";
      const students =
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students");

      let filtered = students;

      if (input?.name && !isAllJurusan && input.className) {
        const nameQuery = input.name.toLowerCase();
        const classQuery = input.className.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            (s.full_name ?? "").toLowerCase().includes(nameQuery) &&
            (s.class_name ?? "").toLowerCase().includes(classQuery),
        );
      } else if (input?.name) {
        const nameQuery = input.name.toLowerCase();
        filtered = filtered.filter((s) =>
          (s.full_name ?? "").toLowerCase().includes(nameQuery),
        );
      } else if (!isAllJurusan && input?.className) {
        const classQuery = input.className.toLowerCase();
        filtered = filtered.filter((s) =>
          (s.class_name ?? "").toLowerCase().includes(classQuery),
        );
      }

      filtered.sort((a, b) => {
        const classA = a.class_name ?? "~~~~";
        const classB = b.class_name ?? "~~~~";
        const classComp = classA.localeCompare(classB);
        if (classComp !== 0) return classComp;
        const nameA = a.full_name ?? "~~~~";
        const nameB = b.full_name ?? "~~~~";
        return nameA.localeCompare(nameB);
      });

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);

      const rows = paged.map((s) => ({
        id: s.user_id,
        userId: s.user_id,
        fullName: s.full_name ?? null,
        email: s.email ?? null,
        nis: s.nis ?? null,
        className: s.class_name ?? null,
        absenceNumber: s.absence_number ?? null,
        avatarUrl: s.avatar_url ?? null,
        gender: s.gender ?? null,
        role: s.role ?? "student",
        createdAt: null,
        updatedAt: null,
      }));

      return {
        data: rows,
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total,
        },
      };
    }),

  // LIST RAW: semua data (hati-hati untuk dataset besar)
  listRaw: adminProcedure.query(async () => {
    const students =
      await astraRequest<AstraStudentProfile[]>("/v1/admin/students");
    return students.map((s) => ({
      id: s.user_id,
      userId: s.user_id,
      fullName: s.full_name ?? null,
      email: s.email ?? null,
      nis: s.nis ?? null,
      className: s.class_name ?? null,
      absenceNumber: s.absence_number ?? null,
      avatarUrl: s.avatar_url ?? null,
      gender: s.gender ?? null,
      role: s.role ?? "student",
      createdAt: null,
      updatedAt: null,
    }));
  }),

  // GET UNIQUE CLASS NAMES: untuk filter dropdown jurusan
  getUniqueClassNames: privilegedProcedure.query(async () => {
    const [classes, students] = await Promise.all([
      astraRequest<AstraClassItem[]>("/v1/admin/classes").catch(() => null),
      astraRequest<Array<{ class_name?: string | null }>>(
        "/v1/admin/students",
      ).catch(() => null),
    ]);

    return collectUniqueClassNames(classes, students);
  }),
});

export type UserProfilesRouter = typeof userProfilesRouter;
