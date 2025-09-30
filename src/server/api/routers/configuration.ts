import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
    createTRPCRouter,
    protectedProcedure,
} from "~/server/api/trpc";
import { configuration } from "~/server/db/schema";

type ConfigurationRow = typeof configuration.$inferSelect;

export const configurationRouter = createTRPCRouter({
    // Get current configuration (should only have one record)
    get: protectedProcedure.query(async ({ ctx }) => {
        const config = await ctx.db
            .select()
            .from(configuration)
            .limit(1);

        return config[0] ?? null;
    }),

    // Get all configurations (for history/audit)
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const configs = await ctx.db
            .select()
            .from(configuration)
            .orderBy(configuration.id);

        return configs;
    }),

    // Get configuration by ID
    getById: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .query(async ({ ctx, input }) => {
            const config = await ctx.db
                .select()
                .from(configuration)
                .where(eq(configuration.id, input.id))
                .limit(1);

            return config[0] ?? null;
        }),

    // Update or create configuration
    upsert: protectedProcedure
        .input(
            z.object({
                longitude: z.number().min(-180).max(180),
                latitude: z.number().min(-90).max(90),
                distance: z.number().min(1).max(10000), // 1 meter to 10km
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Check if configuration exists
            const existingConfig = await ctx.db
                .select()
                .from(configuration)
                .limit(1);

            if (existingConfig.length > 0) {
                // Update existing configuration
                const updated = await ctx.db
                    .update(configuration)
                    .set({
                        longitude: input.longitude,
                        latitude: input.latitude,
                        distance: input.distance,
                    })
                    .where(eq(configuration.id, existingConfig[0]!.id))
                    .returning();

                return updated[0];
            } else {
                // Create new configuration
                const created = await ctx.db
                    .insert(configuration)
                    .values({
                        id: 1, // Single configuration record
                        longitude: input.longitude,
                        latitude: input.latitude,
                        distance: input.distance,
                    })
                    .returning();

                return created[0];
            }
        }),

    // Update configuration by ID
    updateById: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
                data: z.object({
                    longitude: z.number().min(-180).max(180).optional(),
                    latitude: z.number().min(-90).max(90).optional(),
                    distance: z.number().min(1).max(10000).optional(),
                }).refine((data) => Object.keys(data).length > 0, {
                    message: "At least one field must be provided for update",
                }),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const updated = await ctx.db
                .update(configuration)
                .set({
                    ...input.data,
                })
                .where(eq(configuration.id, input.id))
                .returning();

            if (updated.length === 0) {
                throw new Error("Configuration not found");
            }

            return updated[0];
        }),

    // Update specific field
    updateField: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
                field: z.enum(["longitude", "latitude", "distance"]),
                value: z.number(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Validate value based on field
            if (input.field === "longitude" && (input.value < -180 || input.value > 180)) {
                throw new Error("Longitude must be between -180 and 180");
            }
            if (input.field === "latitude" && (input.value < -90 || input.value > 90)) {
                throw new Error("Latitude must be between -90 and 90");
            }
            if (input.field === "distance" && (input.value < 1 || input.value > 10000)) {
                throw new Error("Distance must be between 1 and 10000 meters");
            }

            const updateData = {
                [input.field]: input.value,
            };

            const updated = await ctx.db
                .update(configuration)
                .set(updateData)
                .where(eq(configuration.id, input.id))
                .returning();

            if (updated.length === 0) {
                throw new Error("Configuration not found");
            }

            return updated[0];
        }),

    // Bulk update multiple configurations
    bulkUpdate: protectedProcedure
        .input(
            z.array(
                z.object({
                    id: z.number().int(),
                    longitude: z.number().min(-180).max(180).optional(),
                    latitude: z.number().min(-90).max(90).optional(),
                    distance: z.number().min(1).max(10000).optional(),
                }),
            ),
        )
        .mutation(async ({ ctx, input }) => {
            const results = [];

            for (const item of input) {
                const { id, ...updateData } = item;
                
                // Only update if there are fields to update
                const fieldsToUpdate = Object.keys(updateData).filter(key => updateData[key as keyof typeof updateData] !== undefined);
                if (fieldsToUpdate.length > 0) {
                    const updated = await ctx.db
                        .update(configuration)
                        .set({
                            ...updateData,
                        })
                        .where(eq(configuration.id, id))
                        .returning();

                    if (updated[0]) {
                        results.push(updated[0]);
                    }
                }
            }

            return results;
        }),

    // Batch operations
    batchOperations: protectedProcedure
        .input(
            z.object({
                create: z.array(
                    z.object({
                        id: z.number().int(),
                        longitude: z.number().min(-180).max(180),
                        latitude: z.number().min(-90).max(90),
                        distance: z.number().min(1).max(10000),
                    })
                ).optional(),
                update: z.array(
                    z.object({
                        id: z.number().int(),
                        longitude: z.number().min(-180).max(180).optional(),
                        latitude: z.number().min(-90).max(90).optional(),
                        distance: z.number().min(1).max(10000).optional(),
                    })
                ).optional(),
                delete: z.array(z.number().int()).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const results = {
                created: [] as ConfigurationRow[],
                updated: [] as ConfigurationRow[],
                deleted: [] as ConfigurationRow[],
            };

            // Handle deletions first
            if (input.delete && input.delete.length > 0) {
                for (const id of input.delete) {
                    const deleted = await ctx.db
                        .delete(configuration)
                        .where(eq(configuration.id, id))
                        .returning();
                    
                    if (deleted[0]) {
                        results.deleted.push(deleted[0]);
                    }
                }
            }

            // Handle updates
            if (input.update && input.update.length > 0) {
                for (const item of input.update) {
                    const { id, ...updateData } = item;
                    const fieldsToUpdate = Object.keys(updateData).filter(key => updateData[key as keyof typeof updateData] !== undefined);
                    
                    if (fieldsToUpdate.length > 0) {
                        const updated = await ctx.db
                            .update(configuration)
                            .set({
                                ...updateData,
                            })
                            .where(eq(configuration.id, id))
                            .returning();

                        if (updated[0]) {
                            results.updated.push(updated[0]);
                        }
                    }
                }
            }

            // Handle creations
            if (input.create && input.create.length > 0) {
                for (const item of input.create) {
                    const created = await ctx.db
                        .insert(configuration)
                        .values(item)
                        .returning();

                    if (created[0]) {
                        results.created.push(created[0]);
                    }
                }
            }

            return results;
        }),

    // Count total configurations
    count: protectedProcedure.query(async ({ ctx }) => {
        const result = await ctx.db
            .select({ count: sql<number>`count(*)` })
            .from(configuration);

        return result[0]?.count ?? 0;
    }),

    // Get configurations with pagination
    getPaginated: protectedProcedure
        .input(
            z.object({
                page: z.number().int().min(1).default(1),
                limit: z.number().int().min(1).max(100).default(10),
                orderBy: z.enum(["id", "latitude", "longitude", "distance"]).default("id"),
                orderDirection: z.enum(["asc", "desc"]).default("desc"),
            })
        )
        .query(async ({ ctx, input }) => {
            const offset = (input.page - 1) * input.limit;

            // Get total count
            const countResult = await ctx.db
                .select({ count: sql<number>`count(*)` })
                .from(configuration);
            
            const total = countResult[0]?.count ?? 0;

            // Get paginated data
            const configs = await ctx.db
                .select()
                .from(configuration)
                .limit(input.limit)
                .offset(offset)
                .orderBy(
                    input.orderDirection === "desc" 
                        ? sql`${configuration[input.orderBy]} DESC`
                        : sql`${configuration[input.orderBy]} ASC`
                );

            return {
                data: configs,
                pagination: {
                    page: input.page,
                    limit: input.limit,
                    total,
                    totalPages: Math.ceil(total / input.limit),
                    hasNext: input.page < Math.ceil(total / input.limit),
                    hasPrev: input.page > 1,
                },
            };
        }),

    // Reset to default values
    reset: protectedProcedure.mutation(async ({ ctx }) => {
        const defaultConfig = {
            longitude: 110.2241, // Default coordinates (looks like Indonesia)
            latitude: -7.4503,
            distance: 500, // 500 meters default
        };

        const existingConfig = await ctx.db
            .select()
            .from(configuration)
            .limit(1);

        if (existingConfig.length > 0) {
            const updated = await ctx.db
                .update(configuration)
                .set({
                    ...defaultConfig,
                })
                .where(eq(configuration.id, existingConfig[0]!.id))
                .returning();

            return updated[0];
        } else {
            const created = await ctx.db
                .insert(configuration)
                .values({
                    id: 1,
                    ...defaultConfig,
                })
                .returning();

            return created[0];
        }
    }),

    // Delete configuration by ID
    delete: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ ctx, input }) => {
            const deleted = await ctx.db
                .delete(configuration)
                .where(eq(configuration.id, input.id))
                .returning();

            if (deleted.length === 0) {
                throw new Error("Configuration not found");
            }

            return { success: true, deleted: deleted[0] };
        }),

    // Create new configuration
    create: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
                longitude: z.number().min(-180).max(180),
                latitude: z.number().min(-90).max(90),
                distance: z.number().min(1).max(10000),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const created = await ctx.db
                .insert(configuration)
                .values({
                    id: input.id,
                    longitude: input.longitude,
                    latitude: input.latitude,
                    distance: input.distance,
                })
                .returning();

            return created[0];
        }),
});
