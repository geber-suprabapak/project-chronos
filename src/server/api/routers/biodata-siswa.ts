import { z } from "zod";
import { createTRPCRouter, privilegedProcedure } from "~/server/api/trpc";
import { astraRequest } from "~/lib/astra/client";
import {
  collectUniqueClassNames,
  normalizeStudentRows,
} from "~/lib/class-names";

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

interface AstraClassItem {
  id?: string;
  name: string;
  grade?: number | null;
}

/**
 * Student roster queries backed by Astra API contract boundary.
 */
export const biodataSiswaRouter = createTRPCRouter({
  // GET BY NIS
  getByNis: privilegedProcedure
    .input(z.object({ nis: z.string() }))
    .query(async ({ input }) => {
      const students = normalizeStudentRows(
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
      );

      const student = students.find((s) => s.nis === input.nis);
      if (!student) return null;

      const absenceNum = student.absence_number
        ? parseInt(student.absence_number, 10)
        : null;

      return {
        nis: student.nis ?? input.nis,
        nama: student.full_name ?? null,
        kelas: student.class_name ?? null,
        absen: Number.isNaN(absenceNum) ? null : absenceNum,
        kelamin: student.gender ?? null,
        activated: student.lifecycle_status === "approved",
      };
    }),

  // LIST: ambil daftar biodata siswa dengan pagination dan filtering dari Astra
  list: privilegedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).default(20),
          offset: z.number().int().min(0).default(0),
          nama: z.string().max(255).optional(),
          kelas: z.string().optional(),
          kelamin: z.enum(["L", "P"]).optional(),
          activated: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const students = normalizeStudentRows(
        await astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
      );

      let filtered = students;

      if (input?.nama && input.nama.trim().length > 0) {
        const searchTerm = input.nama.trim().toLowerCase();
        filtered = filtered.filter((s) => {
          const nameMatch = (s.full_name ?? "")
            .toLowerCase()
            .includes(searchTerm);
          const nisMatch = (s.nis ?? "").toLowerCase().includes(searchTerm);
          return nameMatch || nisMatch;
        });
      }

      if (
        input?.kelas &&
        input.kelas !== "ALL" &&
        input.kelas.trim().length > 0
      ) {
        const classQuery = input.kelas.trim().toLowerCase();
        filtered = filtered.filter((s) =>
          (s.class_name ?? "").toLowerCase().includes(classQuery),
        );
      }

      if (input?.kelamin) {
        filtered = filtered.filter((s) => s.gender === input.kelamin);
      }

      if (input?.activated !== undefined) {
        filtered = filtered.filter((s) => {
          const isActivated = s.lifecycle_status === "approved";
          return isActivated === input.activated;
        });
      }

      // Sort by NIS
      filtered.sort((a, b) => {
        const nisA = a.nis ?? "~~~~";
        const nisB = b.nis ?? "~~~~";
        return nisA.localeCompare(nisB, undefined, { numeric: true });
      });

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const total = filtered.length;
      const paged = filtered.slice(offset, offset + limit);

      const rows = paged.map((s) => {
        const absenceNum = s.absence_number
          ? parseInt(s.absence_number, 10)
          : null;
        return {
          nis: s.nis ?? "",
          nama: s.full_name ?? null,
          kelas: s.class_name ?? null,
          absen: Number.isNaN(absenceNum) ? null : absenceNum,
          kelamin: s.gender ?? null,
          activated: s.lifecycle_status === "approved",
        };
      });

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

  // STATISTICS: get overview statistics dari Astra
  getStatistics: privilegedProcedure.query(async () => {
    const students = normalizeStudentRows(
      await astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
    );

    let laki = 0;
    let perempuan = 0;
    let activated = 0;

    for (const s of students) {
      if (s.gender === "L") {
        laki++;
      } else if (s.gender === "P") {
        perempuan++;
      }
      if (s.lifecycle_status === "approved") {
        activated++;
      }
    }

    return {
      total: students.length,
      laki,
      perempuan,
      activated,
    };
  }),

  // LIST RAW: semua data dari Astra
  listRaw: privilegedProcedure.query(async () => {
    const students = normalizeStudentRows(
      await astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
    );

    const sorted = [...students].sort((a, b) => {
      const nisA = a.nis ?? "~~~~";
      const nisB = b.nis ?? "~~~~";
      return nisA.localeCompare(nisB, undefined, { numeric: true });
    });

    return sorted.map((s) => {
      const absenceNum = s.absence_number
        ? parseInt(s.absence_number, 10)
        : null;
      return {
        nis: s.nis ?? "",
        nama: s.full_name ?? null,
        kelas: s.class_name ?? null,
        absen: Number.isNaN(absenceNum) ? null : absenceNum,
        kelamin: s.gender ?? null,
        activated: s.lifecycle_status === "approved",
      };
    });
  }),

  // GET UNIQUE CLASSES: untuk filter dropdown dari Astra
  getUniqueClasses: privilegedProcedure.query(async () => {
    const [classes, students] = await Promise.all([
      astraRequest<AstraClassItem[]>("/v1/admin/classes").catch(() => null),
      astraRequest<Array<{ class_name?: string | null }>>(
        "/v1/admin/students",
      ).catch(() => null),
    ]);

    return collectUniqueClassNames(classes, students);
  }),
});

export type BiodataSiswaRouter = typeof biodataSiswaRouter;
