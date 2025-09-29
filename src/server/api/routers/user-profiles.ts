import { z } from "zod";
import { and, ilike, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userProfiles } from "~/server/db/schema";

/**
 * tRPC router untuk tabel `user_profiles` (Supabase).
 * Fokus pada operasi READ-ONLY (get, list).
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


	// (removed) upsertByUserId: not applicable; table has no user_id column
});

export type UserProfilesRouter = typeof userProfilesRouter;

