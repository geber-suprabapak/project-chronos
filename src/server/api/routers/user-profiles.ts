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
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const whereClause = input?.name
				? ilike(userProfiles.fullName, `%${input.name}%`)
				: undefined;
			const limit = input?.limit ?? 20;
			const offset = input?.offset ?? 0;
			// Run data + total count in parallel
			const [rows, totalResult] = await Promise.all([
				ctx.db
					.select()
					.from(userProfiles)
					.where(whereClause as any)
					.orderBy(
						sql`coalesce(${userProfiles.className}, '~~~~') ASC`,
						sql`coalesce(${userProfiles.fullName}, '~~~~') ASC`
					)
					.limit(limit)
					.offset(offset),
				ctx.db
					.select({ count: sql<number>`count(*)` })
					.from(userProfiles)
					.where(whereClause as any),
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
				userId: z.string().uuid(),
				email: z.string().email(),
				fullName: z.string().min(1).optional(),
				avatarUrl: z.string().url().optional(),
				absenceNumber: z.string().optional(),
				className: z.string().optional(),
				role: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.insert(userProfiles)
				.values({
					userId: input.userId,
					email: input.email,
					fullName: input.fullName,
					avatarUrl: input.avatarUrl,
					absenceNumber: input.absenceNumber,
					className: input.className,
					role: input.role,
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
						userId: z.string().uuid().optional(),
						email: z.string().email().optional(),
						fullName: z.string().min(1).optional(),
						avatarUrl: z.string().url().optional(),
						absenceNumber: z.string().optional(),
						className: z.string().optional(),
						role: z.string().optional(),
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
						userId: z.string().uuid().optional(),
						email: z.string().email().optional(),
						fullName: z.string().min(1).optional(),
						avatarUrl: z.string().url().optional(),
						absenceNumber: z.string().optional(),
						className: z.string().optional(),
						role: z.string().optional(),
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

	// UPSERT by user_id: jika user_id sudah ada, update; jika belum, insert.
	upsertByUserId: protectedProcedure
		.input(
			z.object({
				userId: z.string().uuid(),
				email: z.string().email(),
				fullName: z.string().min(1).optional(),
				avatarUrl: z.string().url().optional(),
				absenceNumber: z.string().optional(),
				className: z.string().optional(),
				role: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const now = new Date();
			const insertValues = {
				userId: input.userId,
				email: input.email,
				fullName: input.fullName,
				avatarUrl: input.avatarUrl,
				absenceNumber: input.absenceNumber,
				className: input.className,
				role: input.role,
				updatedAt: now,
			} as const;

			const [row] = await ctx.db
				.insert(userProfiles)
				.values(insertValues)
				.onConflictDoUpdate({
					target: userProfiles.userId,
					set: {
						email: insertValues.email,
						fullName: insertValues.fullName,
						avatarUrl: insertValues.avatarUrl,
						absenceNumber: insertValues.absenceNumber,
						className: insertValues.className,
						role: insertValues.role,
						updatedAt: now,
					},
					where: and(eq(userProfiles.userId, input.userId)),
				})
				.returning();

			return row;
		}),
});

export type UserProfilesRouter = typeof userProfilesRouter;

