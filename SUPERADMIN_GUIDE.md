# Superadmin System Documentation

This document describes the superadmin system implementation in Project Chronos, which provides hierarchical role-based access control (RBAC) for managing users and permissions.

## Overview

The superadmin system implements a three-tier role hierarchy:
- **Superadmin**: Highest level, can manage all users including other admins
- **Admin**: Can manage regular users but not other admins or superadmins  
- **User**: Regular users with standard access (default role)

## Features

### 1. Role-based Access Control (RBAC)
- Hierarchical permissions system
- Role validation middleware for tRPC procedures
- Automatic role checking and enforcement

### 2. Admin Management Interface
- Complete user management UI at `/admin`
- Role-based navigation (admin menu only visible to admin/superadmin)
- User creation, role modification, and deletion capabilities
- Dashboard with user statistics

### 3. Security Features
- Prevents self-demotion for superadmins
- Validates all role transitions
- Enforces hierarchical permissions
- Database constraints for role integrity

### 4. API Procedures
- `adminProcedure`: Requires admin role or higher
- `superadminProcedure`: Requires superadmin role
- `protectedProcedure`: Requires authentication (any role)

## Setup Instructions

### 1. Database Migration

Run the database migrations to add role constraints:

```bash
# Generate and apply migrations
npm run db:generate
npm run db:migrate

# Or manually apply the role constraints
npm run db:push
```

The migration adds:
- Role validation constraints (`superadmin`, `admin`, `user`)
- Performance indexes on role column
- Default role assignment

### 2. Create First Superadmin

After setting up the database and having at least one user log in:

```bash
# Using the setup script
node scripts/setup-superadmin.js admin@example.com

# Or programmatically
import { createSuperadmin } from '~/server/lib/setup-superadmin';
await createSuperadmin('admin@example.com');
```

### 3. Access Admin Interface

1. Log in with the superadmin account
2. Navigate to `/admin` to access the management interface
3. The admin menu item will appear in the sidebar automatically

## Architecture

### Core Components

1. **Role Utilities** (`src/server/lib/roles.ts`)
   - Role hierarchy definitions
   - Permission checking functions
   - Role validation utilities

2. **Admin Router** (`src/server/api/routers/admin.ts`)
   - User management API endpoints
   - Role modification procedures
   - Dashboard statistics

3. **Enhanced tRPC Middleware** (`src/server/api/trpc.ts`)
   - Role-based procedure creation
   - Automatic role validation
   - Context enhancement with user roles

4. **Admin UI** (`src/app/(main)/admin/page.tsx`)
   - Complete admin management interface
   - User creation and role management
   - Real-time updates and validation

### Database Schema

The `user_profiles` table includes:
- `role` field with constraint checking
- Default role assignment to 'user'
- Proper indexing for performance

```sql
ALTER TABLE "user_profiles" 
ADD CONSTRAINT "user_profiles_role_check" 
CHECK ("role" IN ('superadmin', 'admin', 'user'));
```

## Usage Examples

### API Usage

```typescript
// Check user permissions
import { hasMinimumRole, canChangeRole } from '~/server/lib/roles';

// Admin-only procedure
export const adminOnlyProcedure = adminProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // This automatically ensures user has admin role or higher
    // ctx.userProfile.role is guaranteed to be 'admin' or 'superadmin'
  });

// Role validation
const canPromote = canChangeRole('admin', 'user', 'admin'); // true
const canDemote = canChangeRole('user', 'admin', 'user');   // false
```

### UI Integration

```tsx
// Role-based rendering
const { data: userRole } = api.admin.getMyRole.useQuery();

if (userRole?.role === 'superadmin') {
  // Show superadmin-only features
}

if (['admin', 'superadmin'].includes(userRole?.role ?? '')) {
  // Show admin features
}
```

## Security Considerations

1. **Role Hierarchy**: Always enforced - higher roles can manage lower roles
2. **Self-Protection**: Superadmins cannot demote themselves
3. **Database Constraints**: Role values validated at database level
4. **API Security**: All role changes require proper permissions
5. **UI Protection**: Admin interfaces hidden from unauthorized users

## Permissions Matrix

| Action | User | Admin | Superadmin |
|--------|------|-------|------------|
| View own profile | ✅ | ✅ | ✅ |
| Edit own profile | ✅ | ✅ | ✅ |
| View users list | ❌ | ✅ | ✅ |
| Create users | ❌ | ✅ | ✅ |
| Edit user profiles | ❌ | ✅ | ✅ |
| Delete users | ❌ | ✅ | ✅ |
| Promote to admin | ❌ | ❌ | ✅ |
| Manage admins | ❌ | ❌ | ✅ |
| Access /admin | ❌ | ✅ | ✅ |

## Troubleshooting

### Common Issues

1. **"Access Denied" on /admin page**
   - Ensure user has admin or superadmin role
   - Check database role assignment
   - Verify role constraints are applied

2. **Cannot create superadmin**
   - Ensure user exists in database (has logged in at least once)
   - Run setup script with correct email
   - Check database connection

3. **Role changes not working**
   - Verify role hierarchy permissions
   - Check tRPC middleware is loaded
   - Ensure database constraints are applied

### Debug Commands

```bash
# Check current user roles in database
npm run db:studio

# Test role validation
node -e "
import { hasMinimumRole } from './src/server/lib/roles.js';
console.log(hasMinimumRole('admin', 'user')); // Should be true
"
```

## Future Enhancements

Potential improvements for the superadmin system:

1. **Audit Logging**: Track all admin actions and role changes
2. **Role Permissions**: More granular permissions within roles
3. **Temporary Roles**: Time-limited role assignments
4. **Multi-tenant Support**: Organization-scoped admin roles
5. **2FA for Admins**: Additional security for admin accounts
6. **Bulk Operations**: Mass user import/export functionality

## Contributing

When working with the superadmin system:

1. Always use role-based procedures for admin operations
2. Test permission scenarios thoroughly
3. Maintain role hierarchy consistency
4. Update documentation for new role features
5. Follow security best practices

For questions or issues, please refer to the main project documentation or create an issue in the repository.