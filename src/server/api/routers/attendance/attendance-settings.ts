import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { attendanceSettings } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const attendanceSettingsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.attendanceSettings.findFirst();
    return row ?? null;
  }),
  upsert: protectedProcedure
    .input(z.object({
      id: z.string().uuid().optional(),
      centerLatitude: z.number().min(-90).max(90),
      centerLongitude: z.number().min(-180).max(180),
      radiusMeters: z.number().int().min(10).max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const updated = await ctx.db.update(attendanceSettings)
          .set({
            centerLatitude: input.centerLatitude,
            centerLongitude: input.centerLongitude,
            radiusMeters: input.radiusMeters,
            updatedAt: new Date(),
          })
          .where(eq(attendanceSettings.id, input.id))
          .returning();
        if (updated.length) return updated[0];
      }
      const existing = await ctx.db.query.attendanceSettings.findFirst();
      if (existing) {
        const updated = await ctx.db.update(attendanceSettings)
          .set({
            centerLatitude: input.centerLatitude,
            centerLongitude: input.centerLongitude,
            radiusMeters: input.radiusMeters,
            updatedAt: new Date(),
          })
          .where(eq(attendanceSettings.id, existing.id))
          .returning();
        return updated[0];
      }
      const inserted = await ctx.db.insert(attendanceSettings).values({
        centerLatitude: input.centerLatitude,
        centerLongitude: input.centerLongitude,
        radiusMeters: input.radiusMeters,
      }).returning();
      return inserted[0];
    }),
});

export type AttendanceSettingsRouter = typeof attendanceSettingsRouter;