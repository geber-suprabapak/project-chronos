-- Add role constraint to user_profiles table
-- This migration adds the role hierarchy constraints to ensure data integrity

-- Add constraint to ensure only valid roles are used
ALTER TABLE "user_profiles" 
ADD CONSTRAINT "user_profiles_role_check" 
CHECK ("role" IN ('superadmin', 'admin', 'user'));

-- Add constraint to perizinan table if not exists
ALTER TABLE "perizinan" 
ADD CONSTRAINT "perizinan_kategori_izin_check" 
CHECK ("kategori_izin" IN ('sakit', 'pergi'));

-- Create an index on role for better query performance
CREATE INDEX IF NOT EXISTS "user_profiles_role_idx" ON "user_profiles" ("role");

-- Update any NULL roles to 'user' as default
UPDATE "user_profiles" SET "role" = 'user' WHERE "role" IS NULL;