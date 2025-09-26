import { z } from "zod";
import { and, eq, ilike, sql, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { biodataSiswa } from "~/server/db/schema";

/**
 * tRPC router untuk tabel `biodata_siswa` (Supabase).
 * Fokus pada operasi CRUD dan import CSV massal.
 * 
 * Note: biodata_siswa table has RLS enabled and should primarily be accessed
 * via the RPC function get_biodata_siswa() for security when checking student registration.
 */
export const biodataSiswaRouter = createTRPCRouter({
    // GET BIODATA FOR REGISTRATION CHECK (using RPC function)
    // This uses the secure RPC function from the schema
    getForRegistration: protectedProcedure
        .input(z.object({ nis: z.string() }))
        .query(async ({ ctx, input }) => {
            // Use raw SQL to call the RPC function from schema
            const result = await ctx.db.execute(
                sql`SELECT * FROM public.get_biodata_siswa(${input.nis})`
            );
            return result[0] ?? null;
        }),
    // GET BY NIS (Primary Key)
    getByNis: protectedProcedure
        .input(z.object({ nis: z.bigint() }))
        .query(async ({ ctx, input }) => {
            const row = await ctx.db.query.biodataSiswa.findFirst({
                where: (table, { eq }) => eq(table.nis, input.nis),
            });
            return row ?? null;
        }),

    // LIST: ambil daftar biodata_siswa dengan pagination dan filter
    list: protectedProcedure
        .input(
            z
                .object({
                    limit: z.number().int().min(1).max(100).default(20),
                    offset: z.number().int().min(0).default(0),
                    nama: z.string().optional(),
                    kelas: z.string().optional(),
                    kelamin: z.string().optional(),
                    activated: z.boolean().optional(),
                })
                .optional(),
        )
        .query(async ({ ctx, input }) => {
            // Build where conditions
            const conditions = [];

            if (input?.nama?.trim()) {
                const searchTerm = input.nama.trim();

                // Check if search term is numeric (could be NIS)
                if (/^\d+$/.test(searchTerm)) {
                    // Search by both NIS and name
                    const nisSearch = BigInt(searchTerm);
                    conditions.push(
                        sql`(${biodataSiswa.nama} ILIKE ${'%' + searchTerm + '%'} OR ${biodataSiswa.nis} = ${nisSearch})`
                    );
                } else {
                    // Search only by name
                    conditions.push(ilike(biodataSiswa.nama, `%${searchTerm}%`));
                }
            }

            if (input?.kelas?.trim()) {
                conditions.push(ilike(biodataSiswa.kelas, `%${input.kelas}%`));
            }

            if (input?.kelamin?.trim()) {
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
                    .orderBy(biodataSiswa.kelas, biodataSiswa.absen, biodataSiswa.nama)
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

    // LIST RAW: semua data (untuk export)
    listRaw: protectedProcedure.query(async ({ ctx }) => {
        const rows = await ctx.db
            .select()
            .from(biodataSiswa)
            .orderBy(biodataSiswa.kelas, biodataSiswa.absen, biodataSiswa.nama);
        return rows;
    }),

    // CREATE: membuat biodata siswa baru
    // Note: When a biodata_siswa is created and later a user registers with matching NIS,
    // the handle_new_user() trigger will automatically:
    // 1. Create user_profile linked to this biodata
    // 2. Set activated = true in biodata_siswa
    create: protectedProcedure
        .input(
            z.object({
                // Untuk mengatasi perbedaan antara string dan bigint, 
                // terima salah satunya dan konversi ke bigint
                nis: z.union([
                    z.bigint(),
                    z.string().regex(/^\d+$/).transform(val => BigInt(val)),
                    z.number().int().positive().transform(val => BigInt(val))
                ]),
                nama: z.string().min(1).max(255),
                kelas: z.string().min(1).max(50),
                absen: z.number().int().min(1),
                kelamin: z.enum(["L", "P"]),
                activated: z.boolean().default(false),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            try {
                // Log informasi untuk debug
                console.log("Creating biodata siswa with NIS:", typeof input.nis, input.nis.toString());
                console.log("User:", ctx.user?.id, ctx.user?.email);

                const dataToInsert = {
                    nis: input.nis,
                    nama: input.nama,
                    kelas: input.kelas,
                    absen: input.absen,
                    kelamin: input.kelamin,
                    activated: input.activated,
                };

                // Gunakan try-catch spesifik untuk insert
                try {
                    const [row] = await ctx.db
                        .insert(biodataSiswa)
                        .values(dataToInsert)
                        .returning();

                    return row;
                } catch (insertError) {
                    // Log database error untuk debugging
                    console.error("Database error:", insertError);

                    // Konversi error ke string untuk pemeriksaan
                    const errorMessage = String(insertError);

                    // Error duplicate key (code 23505 adalah untuk unique constraint violations)
                    if (errorMessage.includes("23505") || errorMessage.includes("duplicate key")) {
                        throw new Error(`NIS ${input.nis.toString()} sudah terdaftar dalam database`);
                    }

                    // Error permission denied (code 42501 adalah untuk permission denied)
                    if (errorMessage.includes("42501") || errorMessage.includes("permission denied")) {
                        throw new Error("Akses ditolak: Anda tidak memiliki izin untuk menambahkan data siswa");
                    }

                    throw new Error(`Gagal menambahkan data: ${errorMessage}`);
                }
            } catch (error) {
                console.error("Error creating biodata siswa:", error);

                // Tangkap error umum
                if (error instanceof Error) {
                    // Jika error sudah ditangani di blok try-catch dalam, pesan error sudah spesifik
                    throw new Error(error.message);
                }

                throw new Error("Terjadi kesalahan saat menambahkan data siswa");
            }
        }),

    // BULK CREATE: import CSV massal
    bulkCreate: protectedProcedure
        .input(
            z.object({
                data: z.array(
                    z.object({
                        nis: z.bigint(),
                        nama: z.string().min(1).max(255),
                        kelas: z.string().min(1).max(50),
                        absen: z.number().int().min(1),
                        kelamin: z.enum(["L", "P"]),
                        activated: z.boolean().default(false),
                    })
                ),
                replaceExisting: z.boolean().default(false), // Replace existing records
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { data, replaceExisting } = input;

            if (data.length === 0) {
                return { inserted: 0, updated: 0, errors: [] };
            }

            let inserted = 0;
            let updated = 0;
            const errors: { nis: bigint; error: string }[] = [];

            // Process each record individually to handle conflicts
            for (const record of data) {
                try {
                    if (replaceExisting) {
                        // Use UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
                        await ctx.db
                            .insert(biodataSiswa)
                            .values(record)
                            .onConflictDoUpdate({
                                target: biodataSiswa.nis,
                                set: {
                                    nama: record.nama,
                                    kelas: record.kelas,
                                    absen: record.absen,
                                    kelamin: record.kelamin,
                                    activated: record.activated,
                                },
                            })
                            .returning();

                        // Check if it was insert or update by querying existing record
                        const existing = await ctx.db
                            .select()
                            .from(biodataSiswa)
                            .where(eq(biodataSiswa.nis, record.nis));

                        if (existing.length > 0) {
                            updated++;
                        } else {
                            inserted++;
                        }
                    } else {
                        // Insert only, skip if exists
                        const existing = await ctx.db
                            .select()
                            .from(biodataSiswa)
                            .where(eq(biodataSiswa.nis, record.nis));

                        if (existing.length === 0) {
                            await ctx.db.insert(biodataSiswa).values(record);
                            inserted++;
                        }
                    }
                } catch (error) {
                    errors.push({
                        nis: record.nis,
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }

            return { inserted, updated, errors };
        }),

    // UPDATE by NIS: memperbarui data siswa
    updateByNis: protectedProcedure
        .input(
            z.object({
                nis: z.bigint(),
                data: z
                    .object({
                        nama: z.string().min(1).max(255).optional(),
                        kelas: z.string().min(1).max(50).optional(),
                        absen: z.number().int().min(1).optional(),
                        kelamin: z.enum(["L", "P"]).optional(),
                        activated: z.boolean().optional(),
                    })
                    .refine((d) => Object.keys(d).length > 0, {
                        message: "No fields to update",
                    }),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .update(biodataSiswa)
                .set(input.data)
                .where(eq(biodataSiswa.nis, input.nis))
                .returning();

            return row ?? null;
        }),

    // DELETE by NIS
    deleteByNis: protectedProcedure
        .input(z.object({ nis: z.bigint() }))
        .mutation(async ({ ctx, input }) => {
            const [row] = await ctx.db
                .delete(biodataSiswa)
                .where(eq(biodataSiswa.nis, input.nis))
                .returning();
            return row ?? null;
        }),

    // BULK DELETE: hapus multiple siswa berdasarkan array NIS
    bulkDelete: protectedProcedure
        .input(
            z.object({
                nisList: z.array(z.bigint()).min(1, "Minimal satu NIS harus dipilih"),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { nisList } = input;

            // Get data before deletion for logging
            const studentsToDelete = await ctx.db
                .select({
                    nis: biodataSiswa.nis,
                    nama: biodataSiswa.nama,
                    kelas: biodataSiswa.kelas,
                })
                .from(biodataSiswa)
                .where(inArray(biodataSiswa.nis, nisList));

            if (studentsToDelete.length === 0) {
                throw new Error("Tidak ada data siswa yang ditemukan untuk dihapus");
            }

            // Delete the records
            const deletedRows = await ctx.db
                .delete(biodataSiswa)
                .where(inArray(biodataSiswa.nis, nisList))
                .returning({
                    nis: biodataSiswa.nis,
                    nama: biodataSiswa.nama,
                });

            console.log(`Bulk delete: ${deletedRows.length} students deleted by user ${ctx.user?.email}`,
                deletedRows.map(r => ({ nis: r.nis.toString(), nama: r.nama })));

            return {
                deletedCount: deletedRows.length,
                deletedStudents: deletedRows,
            };
        }),    // GET UNIQUE CLASSES: daftar kelas yang unik untuk filter
    getUniqueClasses: protectedProcedure.query(async ({ ctx }) => {
        const result = await ctx.db
            .selectDistinct({ kelas: biodataSiswa.kelas })
            .from(biodataSiswa)
            .where(sql`${biodataSiswa.kelas} IS NOT NULL AND ${biodataSiswa.kelas} != ''`)
            .orderBy(biodataSiswa.kelas);

        return result.map(row => row.kelas).filter(kelas => kelas !== null);
    }),

    // GET STATS: statistik data siswa
    getStats: protectedProcedure.query(async ({ ctx }) => {
        const [totalResult, activatedResult, genderStats, classStats] = await Promise.all([
            // Total siswa
            ctx.db.select({ count: sql<number>`count(*)` }).from(biodataSiswa),

            // Siswa aktif
            ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(biodataSiswa)
                .where(eq(biodataSiswa.activated, true)),

            // Statistik berdasarkan gender
            ctx.db
                .select({
                    kelamin: biodataSiswa.kelamin,
                    count: sql<number>`count(*)`,
                })
                .from(biodataSiswa)
                .groupBy(biodataSiswa.kelamin),

            // Statistik berdasarkan kelas
            ctx.db
                .select({
                    kelas: biodataSiswa.kelas,
                    count: sql<number>`count(*)`,
                })
                .from(biodataSiswa)
                .groupBy(biodataSiswa.kelas)
                .orderBy(biodataSiswa.kelas),
        ]);

        return {
            total: Number(totalResult[0]?.count ?? 0),
            activated: Number(activatedResult[0]?.count ?? 0),
            genderStats: genderStats.map(stat => ({
                kelamin: stat.kelamin,
                count: Number(stat.count),
            })),
            classStats: classStats.map(stat => ({
                kelas: stat.kelas,
                count: Number(stat.count),
            })),
        };
    }),
});

export type BiodataSiswaRouter = typeof biodataSiswaRouter;
