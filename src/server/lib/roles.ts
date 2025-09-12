/**
 * Role hierarchy and utilities for the superadmin system
 */

export type UserRole = 'superadmin' | 'admin' | 'user';

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superadmin: 3,
} as const;

/**
 * Check if a role has permission to perform actions on another role
 * @param actorRole - Role of the user performing the action
 * @param targetRole - Role of the user being acted upon
 * @returns true if actor has permission over target
 */
export function hasRolePermission(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

/**
 * Check if a role has at least the minimum required level
 * @param userRole - Role to check
 * @param requiredRole - Minimum required role
 * @returns true if user role meets or exceeds required role
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a role is valid
 * @param role - Role string to validate
 * @returns true if role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return role in ROLE_HIERARCHY;
}

/**
 * Get all roles that a user can manage (roles with lower hierarchy)
 * @param userRole - Role of the user
 * @returns Array of manageable roles
 */
export function getManagedRoles(userRole: UserRole): UserRole[] {
  const userLevel = ROLE_HIERARCHY[userRole];
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level < userLevel)
    .map(([role]) => role as UserRole);
}

/**
 * Validate role transition (promotion/demotion)
 * @param actorRole - Role of user making the change
 * @param fromRole - Current role of target user
 * @param toRole - Desired new role
 * @returns true if transition is allowed
 */
export function canChangeRole(actorRole: UserRole, fromRole: UserRole, toRole: UserRole): boolean {
  // Actor must have permission over both source and target roles
  return hasRolePermission(actorRole, fromRole) && hasRolePermission(actorRole, toRole);
}