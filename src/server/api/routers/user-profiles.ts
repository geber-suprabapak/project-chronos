import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userProfiles } from "~/server/db/schema";

/**
 * tRPC router untuk tabel `user_profiles` (Supabase).
 * Fokus pada operasi MUTATION (create, update, delete, upsert).
 */
export const userProfilesRouter = createTRPCRouter({
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

