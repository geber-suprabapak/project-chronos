import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { attendanceSpecialDays } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";

export const attendanceSpecialDaysRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(attendanceSpecialDays).orderBy(attendanceSpecialDays.date);
  }),
  upsert: protectedProcedure.input(z.object({
    id: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["holiday", "early_dismissal", "custom"]),
    name: z.string().min(1).max(120).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    note: z.string().max(500).optional(),
  })).mutation(async ({ ctx, input }) => {
    if (input.id) {
      const updated = await ctx.db.update(attendanceSpecialDays)
        .set({
          date: input.date,
          type: input.type,
          name: input.name,
          startTime: input.startTime,
          endTime: input.endTime,
          note: input.note,
          updatedAt: new Date(),
        })
        .where(eq(attendanceSpecialDays.id, input.id))
        .returning();
      if (updated.length) return updated[0];
    }
    const inserted = await ctx.db.insert(attendanceSpecialDays)
      .values({
        date: input.date,
        type: input.type,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        note: input.note,
      }).returning();
    return inserted[0];
  }),
  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.delete(attendanceSpecialDays).where(eq(attendanceSpecialDays.id, input.id));
    return { success: true };
  })
});

export type AttendanceSpecialDaysRouter = typeof attendanceSpecialDaysRouter;