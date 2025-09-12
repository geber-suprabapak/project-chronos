/**
 * Setup script to create the first superadmin user
 * Run this after setting up the database and having at least one user logged in
 */

import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function createSuperadmin(email: string) {
  try {
    // Check if user exists
    const existingUser = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.email, email),
    });

    if (!existingUser) {
      throw new Error(`User with email ${email} not found. Please ensure the user has logged in at least once.`);
    }

    // Update user to superadmin
    const [updatedUser] = await db
      .update(userProfiles)
      .set({ 
        role: 'superadmin',
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.email, email))
      .returning();

    console.log('✅ Successfully created superadmin:', {
      id: updatedUser?.id,
      email: updatedUser?.email,
      fullName: updatedUser?.fullName,
      role: updatedUser?.role,
    });

    return updatedUser;
  } catch (error) {
    console.error('❌ Failed to create superadmin:', error);
    throw error;
  }
}

// Usage example:
// await createSuperadmin('admin@example.com');