import { prisma } from '../db.js';

/**
 * Ensures critical database schema columns and tables are aligned
 * with Prisma schema on startup, preventing runtime 500 crashes
 * if migrations were not executed.
 */
export async function ensureSchemaIntegrity() {
  try {
    // 1. Ensure Client table has avatarUrl and googleDrive fields
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "googleDriveRefreshToken" TEXT;
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "googleDriveAccessToken" TEXT;
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "googleDriveFolderId" TEXT;
    `);

    // 2. Ensure Patients table has avatarUrl
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
    `);

    console.log('✅ Database schema integrity verified.');
  } catch (err) {
    console.warn('⚠️ Schema integrity check note:', err);
  }
}