import { z } from "zod";
import { and, eq, ilike, sql } from "drizzle-orm";
import {
  createTRPCRouter,
  privilegedProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { userProfiles } from "~/server/db/schema";

function isTransientDbError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|socket/i.test(
    `${code} ${message}`,
  );
}

async function withDbRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    return await operation();
  }
}

/**
 * tRPC router untuk tabel `user_profiles` (Supabase).
 * Fokus pada operasi READ-ONLY (get, list).
 */
export const userProfilesRouter = createTRPCRouter({
  // GET ME: Ambil profil user yang sedang login berdasarkan ctx.user.id
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.userProfiles.findFirst({
      where: (table, { eq }) => eq(table.userId, ctx.user.id),
    });
    return row ?? null;
  }),

  // GET BY ID
  getById: privilegedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      });
      return row ?? null;
    }),
  // LIST: ambil daftar user_profiles dengan pagination sederhana
  list: privilegedProcedure
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
      const isAllJurusan = !input?.className || input.className === "ALL";

      // Create a SQL query conditions
      let whereCondition = undefined;

      if (input?.name && !isAllJurusan && input.className) {
        whereCondition = and(
          ilike(userProfiles.fullName, `%${input.name}%`),
          ilike(userProfiles.className, `%${input.className}%`),
        );
      } else if (input?.name) {
        whereCondition = ilike(userProfiles.fullName, `%${input.name}%`);
      } else if (!isAllJurusan && input?.className) {
        whereCondition = ilike(userProfiles.className, `%${input.className}%`);
      }
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      // Run data + total count in parallel
      const [rows, totalResult] = await withDbRetry(() =>
        Promise.all([
          ctx.db
            .select()
            .from(userProfiles)
            .where(whereCondition)
            .orderBy(
              sql`coalesce(${userProfiles.className}, '~~~~') ASC`,
              sql`coalesce(${userProfiles.fullName}, '~~~~') ASC`,
            )
            .limit(limit)
            .offset(offset),
          ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(userProfiles)
            .where(whereCondition),
        ]),
      );
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
  listRaw: privilegedProcedure.query(async ({ ctx }) => {
    const rows = await withDbRetry(() => ctx.db.select().from(userProfiles));
    return rows;
  }),

  // GET UNIQUE CLASS NAMES: untuk filter dropdown jurusan
  getUniqueClassNames: privilegedProcedure.query(async ({ ctx }) => {
    const classNames = await withDbRetry(() =>
      ctx.db
        .selectDistinct({ className: userProfiles.className })
        .from(userProfiles)
        .where(sql`${userProfiles.className} IS NOT NULL`)
        .orderBy(userProfiles.className),
    );

    return classNames.map((c) => c.className).filter(Boolean);
  }),

  // (intentionally omitted) upsertByUserId: this router is read-only even though `userId` exists in the schema
});

export type UserProfilesRouter = typeof userProfilesRouter;
