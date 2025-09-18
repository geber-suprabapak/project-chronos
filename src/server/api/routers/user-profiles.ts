import { z } from "zod";
import { and, eq, ilike, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userProfiles } from "~/server/db/schema";

/**
 * tRPC router untuk tabel `user_profiles` (Supabase).
 * Fokus pada operasi MUTATION (create, update, delete, upsert).
 */
export const userProfilesRouter = createTRPCRouter({
	// GET BY ID
	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db.query.userProfiles.findFirst({
				where: (table, { eq }) => eq(table.id, input.id),
			});
			return row ?? null;
		}),
	// LIST: ambil daftar user_profiles dengan pagination sederhana
	list: protectedProcedure
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
		.query(async ({ ctx, input }) => {
			// Define conditions based on input
			const isAllJurusan = !input?.className || input.className === 'ALL';

			// Create a SQL query conditions
			let whereCondition = undefined;

			if (input?.name && !isAllJurusan && input.className) {
				whereCondition = and(
					ilike(userProfiles.fullName, `%${input.name}%`),
					ilike(userProfiles.className, `%${input.className}%`)
				);
			} else if (input?.name) {
				whereCondition = ilike(userProfiles.fullName, `%${input.name}%`);
			} else if (!isAllJurusan && input?.className) {
				whereCondition = ilike(userProfiles.className, `%${input.className}%`);
			}
			const limit = input?.limit ?? 20;
			const offset = input?.offset ?? 0;
			// Run data + total count in parallel
			const [rows, totalResult] = await Promise.all([
				ctx.db
					.select()
					.from(userProfiles)
					.where(whereCondition)
					.orderBy(
						sql`coalesce(${userProfiles.className}, '~~~~') ASC`,
						sql`coalesce(${userProfiles.fullName}, '~~~~') ASC`
					)
					.limit(limit)
					.offset(offset),
				ctx.db
					.select({ count: sql<number>`count(*)` })
					.from(userProfiles)
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

	// LIST RAW: semua data (hati-hati untuk dataset besar)
	listRaw: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db.select().from(userProfiles);
		return rows;
	}),
	// CREATE: membuat user_profile baru
	create: protectedProcedure
		.input(
			z.object({
				email: z.string().email(),
				fullName: z.string().min(1).optional(),
				avatarUrl: z.string().url().optional(),
				absenceNumber: z.string().optional(),
				className: z.string().optional(),
				role: z.string().optional(),
				nis: z.string().optional(),
				gender: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.insert(userProfiles)
				.values({
					...input,
					userId: ctx.user.id, // Assuming userId comes from context
				})
				.returning();

			return row;
		}),

	// UPDATE by id: memperbarui field-profile tertentu
	updateById: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: z
					.object({
						email: z.string().email().optional(),
						fullName: z.string().min(1).optional(),
						avatarUrl: z.string().url().optional(),
						absenceNumber: z.string().optional(),
						className: z.string().optional(),
						role: z.string().optional(),
						nis: z.string().optional(),
						gender: z.string().optional(),
					})
					.refine((d) => Object.keys(d).length > 0, {
						message: "No fields to update",
					}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.update(userProfiles)
				.set({ ...input.data, updatedAt: new Date() })
				.where(eq(userProfiles.id, input.id))
				.returning();

			return row ?? null; // null bila tidak ada row ter-update
		}),

	// UPDATE (alias): sama dengan updateById untuk konsistensi nama hook di FE
	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				data: z
					.object({
						email: z.string().email().optional(),
						fullName: z.string().min(1).optional(),
						avatarUrl: z.string().url().optional(),
						absenceNumber: z.string().optional(),
						className: z.string().optional(),
						role: z.string().optional(),
						nis: z.string().optional(),
						gender: z.string().optional(),
					})
					.refine((d) => Object.keys(d).length > 0, {
						message: "No fields to update",
					}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.update(userProfiles)
				.set({ ...input.data, updatedAt: new Date() })
				.where(eq(userProfiles.id, input.id))
				.returning();

			return row ?? null;
		}),

	// DELETE by id
	deleteById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.delete(userProfiles)
				.where(eq(userProfiles.id, input.id))
				.returning();
			return row ?? null;
		}),

	// (removed) upsertByUserId: not applicable; table has no user_id column
});

export type UserProfilesRouter = typeof userProfilesRouter;

