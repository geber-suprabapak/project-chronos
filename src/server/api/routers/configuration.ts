import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { astraRequest } from "~/lib/astra/client";

export interface AstraLocation {
  id: string;
  school_id?: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export function mapAstraLocation(loc: AstraLocation, indexFallback?: number) {
  const numericId = parseInt(loc.id, 10);
  const safeId = !Number.isNaN(numericId) ? numericId : (indexFallback ?? 1);

  return {
    id: safeId,
    astraId: loc.id,
    name: loc.name,
    latitude: loc.latitude,
    longitude: loc.longitude,
    distance: loc.radius_meters,
    isActive: loc.is_active,
    createdAt: loc.created_at ? new Date(loc.created_at) : new Date(),
    updatedAt: loc.updated_at ? new Date(loc.updated_at) : new Date(),
  };
}

/**
 * Router tRPC untuk konfigurasi lokasi yang di-route melalui Astra API contract v1.
 */
export const locationRouter = createTRPCRouter({
  // Get current active location (primary location for system)
  get: protectedProcedure.query(async () => {
    try {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations?isActive=true",
      );
      const active = locations.find((loc) => loc.is_active) ?? locations[0];
      return active ? mapAstraLocation(active, 1) : null;
    } catch {
      return null;
    }
  }),

  // Get all locations (both active and inactive)
  getAll: protectedProcedure.query(async () => {
    try {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      return locations.map((loc, idx) => mapAstraLocation(loc, idx + 1));
    } catch {
      return [];
    }
  }),

  // Get only active locations
  getActive: protectedProcedure.query(async () => {
    try {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations?isActive=true",
      );
      return locations
        .filter((loc) => loc.is_active)
        .map((loc, idx) => mapAstraLocation(loc, idx + 1));
    } catch {
      return [];
    }
  }),

  // Get location by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const locations = await astraRequest<AstraLocation[]>(
          "/v1/admin/locations",
        );
        const idStr = String(input.id);
        const loc = locations.find(
          (l, idx) => l.id === idStr || idx + 1 === input.id,
        );
        return loc ? mapAstraLocation(loc, input.id) : null;
      } catch {
        return null;
      }
    }),

  // Create new location
  create: adminProcedure
    .input(
      z.object({
        id: z.number().min(1).optional(),
        name: z.string().min(1).max(255),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        distance: z.number().min(1).max(10000),
        isActive: z.boolean().optional().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const created = await astraRequest<AstraLocation>("/v1/admin/locations", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          radius_meters: input.distance,
          is_active: input.isActive,
        }),
      });

      return mapAstraLocation(created, input.id ?? 1);
    }),

  // Update location by ID
  updateById: adminProcedure
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          name: z.string().min(1).max(255).optional(),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          distance: z.number().min(1).max(10000).optional(),
          isActive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const idStr = String(input.id);
      const target = locations.find(
        (l, idx) => l.id === idStr || idx + 1 === input.id,
      );
      const targetId = target ? target.id : idStr;

      const updated = await astraRequest<AstraLocation>(
        `/v1/admin/locations/${targetId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: input.data.name,
            latitude: input.data.latitude,
            longitude: input.data.longitude,
            radius_meters: input.data.distance,
            is_active: input.data.isActive,
          }),
        },
      );

      return mapAstraLocation(updated, input.id);
    }),

  // Toggle location active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const idStr = String(input.id);
      const target = locations.find(
        (l, idx) => l.id === idStr || idx + 1 === input.id,
      );

      if (!target) {
        throw new Error("Location not found");
      }

      const updated = await astraRequest<AstraLocation>(
        `/v1/admin/locations/${target.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            is_active: !target.is_active,
          }),
        },
      );

      return mapAstraLocation(updated, input.id);
    }),

  // Delete location
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const idStr = String(input.id);
      const target = locations.find(
        (l, idx) => l.id === idStr || idx + 1 === input.id,
      );
      const targetId = target ? target.id : idStr;

      await astraRequest<{ id: string }>(`/v1/admin/locations/${targetId}`, {
        method: "DELETE",
      });

      return target ? mapAstraLocation(target, input.id) : null;
    }),

  // Update single field quickly
  updateField: adminProcedure
    .input(
      z.object({
        id: z.number(),
        field: z.enum(["name", "latitude", "longitude", "distance"]),
        value: z.union([z.string(), z.number()]),
      }),
    )
    .mutation(async ({ input }) => {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const idStr = String(input.id);
      const target = locations.find(
        (l, idx) => l.id === idStr || idx + 1 === input.id,
      );
      const targetId = target ? target.id : idStr;

      const payload: Record<string, string | number> = {};
      if (input.field === "distance") {
        payload.radius_meters = Number(input.value);
      } else {
        payload[input.field] = input.value;
      }

      const updated = await astraRequest<AstraLocation>(
        `/v1/admin/locations/${targetId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      return mapAstraLocation(updated, input.id);
    }),

  // Upsert location (for primary location management)
  upsert: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        distance: z.number().min(1).max(10000),
      }),
    )
    .mutation(async ({ input }) => {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const existing = locations[0];

      if (existing) {
        const updated = await astraRequest<AstraLocation>(
          `/v1/admin/locations/${existing.id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: input.name,
              latitude: input.latitude,
              longitude: input.longitude,
              radius_meters: input.distance,
              is_active: true,
            }),
          },
        );
        return mapAstraLocation(updated, 1);
      }

      const created = await astraRequest<AstraLocation>("/v1/admin/locations", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          radius_meters: input.distance,
          is_active: true,
        }),
      });

      return mapAstraLocation(created, 1);
    }),

  // Reset to default configuration
  reset: adminProcedure.mutation(async () => {
    const defaultConfig = {
      name: "Kantor Pusat",
      latitude: -7.4503,
      longitude: 110.2241,
      radius_meters: 500,
      is_active: true,
    };

    const locations = await astraRequest<AstraLocation[]>(
      "/v1/admin/locations",
    );
    const existing = locations[0];

    if (existing) {
      const updated = await astraRequest<AstraLocation>(
        `/v1/admin/locations/${existing.id}`,
        {
          method: "PUT",
          body: JSON.stringify(defaultConfig),
        },
      );
      return mapAstraLocation(updated, 1);
    }

    const created = await astraRequest<AstraLocation>("/v1/admin/locations", {
      method: "POST",
      body: JSON.stringify(defaultConfig),
    });

    return mapAstraLocation(created, 1);
  }),

  // Bulk operations
  createMany: adminProcedure
    .input(
      z.array(
        z.object({
          id: z.number().min(1).optional(),
          name: z.string().min(1).max(255),
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          distance: z.number().min(1).max(10000),
          isActive: z.boolean().optional().default(true),
        }),
      ),
    )
    .mutation(async ({ input }) => {
      const results = [];
      for (let i = 0; i < input.length; i++) {
        const item = input[i]!;
        const created = await astraRequest<AstraLocation>(
          "/v1/admin/locations",
          {
            method: "POST",
            body: JSON.stringify({
              name: item.name,
              latitude: item.latitude,
              longitude: item.longitude,
              radius_meters: item.distance,
              is_active: item.isActive,
            }),
          },
        );
        results.push(mapAstraLocation(created, item.id ?? i + 1));
      }
      return results;
    }),

  // Get location statistics
  getStats: protectedProcedure.query(async () => {
    try {
      const locations = await astraRequest<AstraLocation[]>(
        "/v1/admin/locations",
      );
      const total = locations.length;
      const active = locations.filter((loc) => loc.is_active).length;
      const inactive = total - active;
      const distances = locations.map((loc) => loc.radius_meters);
      const avgDistance =
        total > 0 ? distances.reduce((sum, d) => sum + d, 0) / total : 0;
      const maxDistance = total > 0 ? Math.max(...distances) : 0;
      const minDistance = total > 0 ? Math.min(...distances) : 0;

      return {
        total,
        active,
        inactive,
        avgDistance: Math.round(avgDistance),
        maxDistance,
        minDistance,
      };
    } catch {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        avgDistance: 0,
        maxDistance: 0,
        minDistance: 0,
      };
    }
  }),
});
