-- Align live clients table with the Prisma schema and existing client routes.
ALTER TABLE "clients"
ADD COLUMN "alternatePhone" TEXT,
ADD COLUMN "clientCode" TEXT,
ADD COLUMN "emergencyContactName" TEXT,
ADD COLUMN "emergencyContactPhone" TEXT,
ADD COLUMN "emergencyContactRelation" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "preferredContact" TEXT DEFAULT 'Phone',
ADD COLUMN "referralSource" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "title" TEXT;

CREATE UNIQUE INDEX "clients_clinicId_clientCode_key" ON "clients"("clinicId", "clientCode");
