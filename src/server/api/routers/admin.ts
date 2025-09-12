import { z } from "zod";
import { eq, sql, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure, protectedProcedure } from "~/server/api/trpc";
import { userProfiles } from "~/server/db/schema";
import { 
  hasRolePermission, 
  canChangeRole, 
  getManagedRoles, 
  isValidRole,
  type UserRole 
} from "~/server/lib/roles";

/**
 * Admin management router - provides CRUD operations for managing users
 * Superadmin can manage all users, admin can manage regular users
 */
export const adminRouter = createTRPCRouter({
  /**
   * Get current user's role and permissions
   */
  getMyRole: protectedProcedure.query(async ({ ctx }) => {
    const userProfile = ctx.userProfile;
    if (!userProfile?.role || !isValidRole(userProfile.role)) {
      return { role: 'user' as UserRole, managedRoles: [] };
    }
    
    return {
      role: userProfile.role as UserRole,
      managedRoles: getManagedRoles(userProfile.role as UserRole),
    };
  }),

  /**
   * List all users that the current user can manage
   * Superadmin sees all users, admin sees only users (not other admins)
   */
  listManagedUsers: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
        roleFilter: z.enum(['superadmin', 'admin', 'user']).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const userRole = ctx.userProfile?.role as UserRole;
      const managedRoles = getManagedRoles(userRole);
      
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const search = input?.search?.trim();
      const roleFilter = input?.roleFilter;

      // Build where conditions
      const conditions = [];

      // Role filtering based on user permissions
      if (roleFilter && managedRoles.includes(roleFilter)) {
        conditions.push(eq(userProfiles.role, roleFilter));
      } else if (managedRoles.length > 0) {
        // If no specific role filter, show all manageable roles
        const roleConditions = managedRoles.map(role => eq(userProfiles.role, role));
        if (roleConditions.length === 1) {
          conditions.push(roleConditions[0]!);
        } else {
          conditions.push(sql`${userProfiles.role} IN (${sql.join(managedRoles.map(r => `'${r}'`), sql`, `)})`);
        }
      } else {
        // If user can't manage any roles, return empty result
        return { data: [], meta: { total: 0, limit, offset, hasMore: false } };
      }

      // Search filtering
      if (search) {
        conditions.push(
          sql`(${userProfiles.fullName} ILIKE ${'%' + search + '%'} OR ${userProfiles.email} ILIKE ${'%' + search + '%'})`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Fetch data and count in parallel
      const [rows, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: userProfiles.id,
            email: userProfiles.email,
            fullName: userProfiles.fullName,
            role: userProfiles.role,
            className: userProfiles.className,
            nis: userProfiles.nis,
            createdAt: userProfiles.createdAt,
            updatedAt: userProfiles.updatedAt,
          })
          .from(userProfiles)
          .where(whereClause)
          .orderBy(userProfiles.role, userProfiles.fullName)
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(userProfiles)
          .where(whereClause),
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

  /**
   * Get user details by ID (if manageable by current user)
   */
  getUserById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userRole = ctx.userProfile?.role as UserRole;
      
      const user = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.id, input.id),
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Check if current user can manage this user
      if (user.role && isValidRole(user.role) && !hasRolePermission(userRole, user.role)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You don't have permission to view this user" 
        });
      }

      return user;
    }),

  /**
   * Update user role (superadmin only for admin promotion, admin can manage users)
   */
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      newRole: z.enum(['superadmin', 'admin', 'user']),
    }))
    .mutation(async ({ ctx, input }) => {
      const actorRole = ctx.userProfile?.role as UserRole;
      
      // Get target user
      const targetUser = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.id, input.userId),
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const currentRole = (targetUser.role as UserRole) || 'user';
      
      // Check if role change is allowed
      if (!canChangeRole(actorRole, currentRole, input.newRole)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `You don't have permission to change role from ${currentRole} to ${input.newRole}` 
        });
      }

      // Prevent self-demotion for superadmin
      if (ctx.user.email === targetUser.email && actorRole === 'superadmin' && input.newRole !== 'superadmin') {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "Superadmin cannot demote themselves" 
        });
      }

      // Update the role
      const [updatedUser] = await ctx.db
        .update(userProfiles)
        .set({ 
          role: input.newRole,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.id, input.userId))
        .returning();

      return updatedUser;
    }),

  /**
   * Delete user (if manageable by current user)
   */
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const actorRole = ctx.userProfile?.role as UserRole;
      
      // Get target user
      const targetUser = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.id, input.userId),
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      // Prevent self-deletion
      if (ctx.user.email === targetUser.email) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You cannot delete your own account" 
        });
      }

      const targetRole = (targetUser.role as UserRole) || 'user';
      
      // Check if user can delete this role
      if (!hasRolePermission(actorRole, targetRole)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `You don't have permission to delete ${targetRole} users` 
        });
      }

      // Delete the user
      const [deletedUser] = await ctx.db
        .delete(userProfiles)
        .where(eq(userProfiles.id, input.userId))
        .returning();

      return deletedUser;
    }),

  /**
   * Create new user with specific role (admin and superadmin only)
   */
  createUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      role: z.enum(['admin', 'user']).default('user'),
      className: z.string().optional(),
      nis: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actorRole = ctx.userProfile?.role as UserRole;
      
      // Check if actor can create users with this role
      if (!hasRolePermission(actorRole, input.role)) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: `You don't have permission to create ${input.role} users` 
        });
      }

      // Check if user already exists
      const existingUser = await ctx.db.query.userProfiles.findFirst({
        where: (table, { eq }) => eq(table.email, input.email),
      });

      if (existingUser) {
        throw new TRPCError({ 
          code: "CONFLICT", 
          message: "User with this email already exists" 
        });
      }

      // Create the user
      const [newUser] = await ctx.db
        .insert(userProfiles)
        .values({
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          className: input.className,
          nis: input.nis,
        })
        .returning();

      return newUser;
    }),

  /**
   * Get admin dashboard stats (superadmin and admin only)
   */
  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    const userRole = ctx.userProfile?.role as UserRole;
    
    // Base queries
    const queries = [
      ctx.db.select({ count: sql<number>`count(*)` }).from(userProfiles).where(eq(userProfiles.role, 'user')),
    ];

    // Add admin count for superadmin
    if (userRole === 'superadmin') {
      queries.push(
        ctx.db.select({ count: sql<number>`count(*)` }).from(userProfiles).where(eq(userProfiles.role, 'admin')),
        ctx.db.select({ count: sql<number>`count(*)` }).from(userProfiles).where(eq(userProfiles.role, 'superadmin'))
      );
    }

    const results = await Promise.all(queries);
    
    const stats: Record<string, number> = {
      totalUsers: Number(results[0]?.[0]?.count ?? 0),
    };

    if (userRole === 'superadmin') {
      stats.totalAdmins = Number(results[1]?.[0]?.count ?? 0);
      stats.totalSuperadmins = Number(results[2]?.[0]?.count ?? 0);
      stats.totalAll = stats.totalUsers + stats.totalAdmins + stats.totalSuperadmins;
    }

    return stats;
  }),
});

export type AdminRouter = typeof adminRouter;