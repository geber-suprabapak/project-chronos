import { z } from "zod";
import { eq } from "drizzle-orm";
import {
    createTRPCRouter,
    protectedProcedure,
} from "~/server/api/trpc";
import { configuration } from "~/server/db/schema";

export const configurationRouter = createTRPCRouter({
    // Get current configuration (should only have one record)
    get: protectedProcedure.query(async ({ ctx }) => {
        const config = await ctx.db
            .select()
            .from(configuration)
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
                        updatedAt: new Date(),
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
                    updatedAt: new Date(),
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
});
