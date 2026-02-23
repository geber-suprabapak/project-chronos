import { z } from "zod";
import { and, eq, ilike, sql, or } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { biodataSiswa, userProfiles } from "~/server/db/schema";

/**
 * tRPC router untuk tabel `biodata_siswa`.
 * Fokus pada operasi READ dan statistik siswa.
 */
export const biodataSiswaRouter = createTRPCRouter({
    // GET BY NIS
    getByNis: protectedProcedure
        .input(z.object({ nis: z.string() }))
        .query(async ({ ctx, input }) => {
            const row = await ctx.db.query.biodataSiswa.findFirst({
                where: (table, { eq }) => eq(table.nis, BigInt(input.nis)),
            });

            if (!row) return null;

            // Convert BigInt to string for serialization
            return {
                ...row,
                nis: row.nis.toString(),
            };
        }),

    // LIST: ambil daftar biodata siswa dengan pagination dan filtering
    list: protectedProcedure
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
        .query(async ({ ctx, input }) => {
            // Create conditions based on input
            const conditions = [];

            if (input?.nama && input.nama.trim().length > 0) {
                const searchTerm = input.nama.trim();

                // Check if the search term is a number (NIS search)
                const isNumeric = /^\d+$/.test(searchTerm);

                if (isNumeric) {
                    // Search by NIS (convert to bigint for comparison)
                    try {
                        const nisValue = BigInt(searchTerm);
                        conditions.push(eq(biodataSiswa.nis, nisValue));
                    } catch {
                        // If conversion fails, fall back to name search
                        conditions.push(ilike(biodataSiswa.nama, `%${searchTerm}%`));
                    }
                } else {
                    // Search by name or allow mixed search (name OR NIS contains the term)
                    conditions.push(
                        or(
                            ilike(biodataSiswa.nama, `%${searchTerm}%`),
                            sql`CAST(${biodataSiswa.nis} AS TEXT) ILIKE ${`%${searchTerm}%`}`
                        )
                    );
                }
            }

            if (input?.kelas && input.kelas !== 'ALL' && input.kelas.trim().length > 0) {
                conditions.push(ilike(biodataSiswa.kelas, `%${input.kelas.trim()}%`));
            }

            if (input?.kelamin) {
                conditions.push(eq(biodataSiswa.kelamin, input.kelamin));
            }

            if (input?.activated !== undefined) {
                conditions.push(eq(biodataSiswa.activated, input.activated));
            }

            const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
            const limit = input?.limit ?? 20;
            const offset = input?.offset ?? 0;

            // Run data + total count in parallel
            const [rows, totalResult] = await Promise.all([
                ctx.db
                    .select()
                    .from(biodataSiswa)
                    .where(whereCondition)
                    .orderBy(biodataSiswa.nis)
                    .limit(limit)
                    .offset(offset),
                ctx.db
                    .select({ count: sql<number>`count(*)` })
                    .from(biodataSiswa)
                    .where(whereCondition),
            ]);

            const total = Number(totalResult[0]?.count ?? 0);

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

    // STATISTICS: get overview statistics
    getStatistics: protectedProcedure.query(async ({ ctx }) => {
        const [
            totalSiswa,
            siswaLaki,
            siswaPerempuan,
            siswaAktif,
        ] = await Promise.all([
            // Total siswa
            ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(biodataSiswa),
            // Siswa laki-laki
            ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(biodataSiswa)
                .where(eq(biodataSiswa.kelamin, "L")),
            // Siswa perempuan
            ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(biodataSiswa)
                .where(eq(biodataSiswa.kelamin, "P")),
            // Siswa yang sudah diaktifkan
            ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(biodataSiswa)
                .where(eq(biodataSiswa.activated, true)),
        ]);

        return {
            total: Number(totalSiswa[0]?.count ?? 0),
            laki: Number(siswaLaki[0]?.count ?? 0),
            perempuan: Number(siswaPerempuan[0]?.count ?? 0),
            activated: Number(siswaAktif[0]?.count ?? 0),
        };
    }),

    // LIST RAW: semua data (hati-hati untuk dataset besar)
    listRaw: protectedProcedure.query(async ({ ctx }) => {
        const rows = await ctx.db
            .select()
            .from(biodataSiswa)
            .orderBy(biodataSiswa.nis);
        return rows;
    }),

    // GET UNIQUE CLASSES: untuk filter dropdown
    getUniqueClasses: protectedProcedure.query(async ({ ctx }) => {
        const classes = await ctx.db
            .selectDistinct({ kelas: biodataSiswa.kelas })
            .from(biodataSiswa)
            .where(sql`${biodataSiswa.kelas} IS NOT NULL`)
            .orderBy(biodataSiswa.kelas);

        return classes.map(c => c.kelas).filter(Boolean);
    }),

    // SEARCH STUDENTS: Real-time search by name/NIS with kelas filter
    // Only returns students who have activated accounts (exist in user_profiles)
    searchStudents: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1).max(255),
                kelas: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const searchTerm = input.query.trim();
            if (!searchTerm) return [];

            const conditions = [];
            const isNumeric = /^\d+$/.test(searchTerm);

            if (isNumeric) {
                // Search by NIS (cast bigint to text for ILIKE)
                conditions.push(
                    sql`CAST(${biodataSiswa.nis} AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                );
            } else {
                // Search by name
                conditions.push(
                    or(
                        ilike(biodataSiswa.nama, `%${searchTerm}%`),
                        sql`CAST(${biodataSiswa.nis} AS TEXT) ILIKE ${`%${searchTerm}%`}`,
                    ),
                );
            }

            // Optional kelas filter
            if (input.kelas && input.kelas !== "ALL") {
                conditions.push(ilike(biodataSiswa.kelas, `%${input.kelas}%`));
            }

            // Only return activated students who have user accounts
            conditions.push(eq(biodataSiswa.activated, true));

            const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

            // Join with user_profiles to get userId (needed for creating perizinan)
            const rows = await ctx.db
                .select({
                    nis: biodataSiswa.nis,
                    nama: biodataSiswa.nama,
                    kelas: biodataSiswa.kelas,
                    absen: biodataSiswa.absen,
                    kelamin: biodataSiswa.kelamin,
                    userId: userProfiles.userId,
                    fullName: userProfiles.fullName,
                })
                .from(biodataSiswa)
                .innerJoin(
                    userProfiles,
                    sql`CAST(${biodataSiswa.nis} AS TEXT) = ${userProfiles.nis}`,
                )
                .where(whereCondition)
                .orderBy(biodataSiswa.nama)
                .limit(10);

            return rows.map((r) => ({
                nis: r.nis.toString(),
                nama: r.nama ?? r.fullName ?? "Unknown",
                kelas: r.kelas ?? "-",
                absen: r.absen,
                kelamin: r.kelamin,
                userId: r.userId,
            }));
        }),
});

export type BiodataSiswaRouter = typeof biodataSiswaRouter;

