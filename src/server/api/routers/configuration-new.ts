import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import {
    createTRPCRouter,
    protectedProcedure,
} from "~/server/api/trpc";
import { location } from "~/server/db/schema";

export const locationRouter = createTRPCRouter({
    // Get current active location (primary location for system)
    get: protectedProcedure.query(async ({ ctx }) => {
        const config = await ctx.db
            .select()
            .from(location)
            .where(eq(location.isActive, true))
            .orderBy(desc(location.updatedAt))
            .limit(1);

        return config[0] ?? null;
    }),

    // Get all locations (both active and inactive)
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const configs = await ctx.db
            .select()
            .from(location)
            .orderBy(desc(location.createdAt));

        return configs;
    }),

    // Get only active locations
    getActive: protectedProcedure.query(async ({ ctx }) => {
        const configs = await ctx.db
            .select()
            .from(location)
            .where(eq(location.isActive, true))
            .orderBy(desc(location.createdAt));

        return configs;
    }),

    // Get location by ID
    getById: protectedProcedure
        .input(z.object({ id: z.number() }))
        .query(async ({ ctx, input }) => {
            const config = await ctx.db
                .select()
                .from(location)
                .where(eq(location.id, input.id))
                .limit(1);

            return config[0] ?? null;
        }),

    // Create new location
    create: protectedProcedure
        .input(z.object({
            id: z.number().min(1),
            name: z.string().min(1).max(255),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            distance: z.number().min(1).max(10000),
            isActive: z.boolean().optional().default(true),
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db
                .insert(location)
                .values({
                    id: input.id,
                    name: input.name,
                    latitude: input.latitude,
                    longitude: input.longitude,
                    distance: input.distance,
                    isActive: input.isActive,
                })
                .returning();

            return result[0];
        }),

    // Update location by ID
    updateById: protectedProcedure
        .input(z.object({
            id: z.number(),
            data: z.object({
                name: z.string().min(1).max(255).optional(),
                latitude: z.number().min(-90).max(90).optional(),
                longitude: z.number().min(-180).max(180).optional(),
                distance: z.number().min(1).max(10000).optional(),
                isActive: z.boolean().optional(),
            })
        }))
        .mutation(async ({ ctx, input }) => {
            const updateData: Record<string, unknown> = {
                ...input.data,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            };

            const result = await ctx.db
                .update(location)
                .set(updateData)
                .where(eq(location.id, input.id))
                .returning();

            return result[0] ?? null;
        }),

    // Toggle location active status
    toggleActive: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            // Get current status
            const current = await ctx.db
                .select({ isActive: location.isActive })
                .from(location)
                .where(eq(location.id, input.id))
                .limit(1);

            if (!current[0]) {
                throw new Error("Location not found");
            }

            // Toggle status
            const result = await ctx.db
                .update(location)
                .set({
                    isActive: !current[0].isActive,
                    updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(eq(location.id, input.id))
                .returning();

            return result[0];
        }),

    // Delete location
    delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db
                .delete(location)
                .where(eq(location.id, input.id))
                .returning();

            return result[0] ?? null;
        }),

    // Update single field quickly
    updateField: protectedProcedure
        .input(z.object({
            id: z.number(),
            field: z.enum(["name", "latitude", "longitude", "distance"]),
            value: z.union([z.string(), z.number()]),
        }))
        .mutation(async ({ ctx, input }) => {
            const updateData: Record<string, unknown> = {
                [input.field]: input.value,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            };

            const result = await ctx.db
                .update(location)
                .set(updateData)
                .where(eq(location.id, input.id))
                .returning();

            return result[0] ?? null;
        }),

    // Upsert location (for primary location management)
    upsert: protectedProcedure
        .input(z.object({
            name: z.string().min(1).max(255),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            distance: z.number().min(1).max(10000),
        }))
        .mutation(async ({ ctx, input }) => {
            // Check if there's an existing primary location (id = 1)
            const existing = await ctx.db
                .select()
                .from(location)
                .where(eq(location.id, 1))
                .limit(1);

            if (existing[0]) {
                // Update existing primary location
                const result = await ctx.db
                    .update(location)
                    .set({
                        name: input.name,
                        latitude: input.latitude,
                        longitude: input.longitude,
                        distance: input.distance,
                        isActive: true,
                        updatedAt: sql`CURRENT_TIMESTAMP`,
                    })
                    .where(eq(location.id, 1))
                    .returning();

                return result[0];
            } else {
                // Create new primary location
                const result = await ctx.db
                    .insert(location)
                    .values({
                        id: 1,
                        name: input.name,
                        latitude: input.latitude,
                        longitude: input.longitude,
                        distance: input.distance,
                        isActive: true,
                    })
                    .returning();

                return result[0];
            }
        }),

    // Reset to default configuration
    reset: protectedProcedure.mutation(async ({ ctx }) => {
        const defaultConfig = {
            id: 1,
            name: "Kantor Pusat",
            latitude: -7.4503,
            longitude: 110.2241,
            distance: 500,
            isActive: true,
        };

        // Delete existing primary location if exists
        await ctx.db
            .delete(location)
            .where(eq(location.id, 1));

        // Insert default configuration
        const result = await ctx.db
            .insert(location)
            .values(defaultConfig)
            .returning();

        return result[0];
    }),

    // Bulk operations
    createMany: protectedProcedure
        .input(z.array(z.object({
            id: z.number().min(1),
            name: z.string().min(1).max(255),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            distance: z.number().min(1).max(10000),
            isActive: z.boolean().optional().default(true),
        })))
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db
                .insert(location)
                .values(input)
                .returning();

            return result;
        }),

    // Get location statistics
    getStats: protectedProcedure.query(async ({ ctx }) => {
        const stats = await ctx.db
            .select({
                total: sql<number>`count(*)`,
                active: sql<number>`count(*) filter (where ${location.isActive} = true)`,
                inactive: sql<number>`count(*) filter (where ${location.isActive} = false)`,
                avgDistance: sql<number>`avg(${location.distance})`,
                maxDistance: sql<number>`max(${location.distance})`,
                minDistance: sql<number>`min(${location.distance})`,
            })
            .from(location);

        return stats[0] ?? {
            total: 0,
            active: 0,
            inactive: 0,
            avgDistance: 0,
            maxDistance: 0,
            minDistance: 0,
        };
    }),
});
