import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { attendanceDefaultHours } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";

export const attendanceDefaultHoursRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(attendanceDefaultHours);
  }),
  upsertDay: protectedProcedure.input(z.object({
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.query.attendanceDefaultHours.findFirst({
      where: (tbl, { eq }) => eq(tbl.dayOfWeek, input.dayOfWeek)
    });
    if (existing) {
      const updated = await ctx.db.update(attendanceDefaultHours)
        .set({ startTime: input.startTime, endTime: input.endTime, updatedAt: new Date() })
        .where(eq(attendanceDefaultHours.id, existing.id))
        .returning();
      return updated[0];
    }
    const inserted = await ctx.db.insert(attendanceDefaultHours)
      .values({ dayOfWeek: input.dayOfWeek, startTime: input.startTime, endTime: input.endTime })
      .returning();
    return inserted[0];
  }),
  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(attendanceDefaultHours).where(eq(attendanceDefaultHours.id, input.id));
    return { success: true };
  })
});

export type AttendanceDefaultHoursRouter = typeof attendanceDefaultHoursRouter;