-- Add richer portal invite + messaging support for unified client portal release

ALTER TABLE "ai_conversations"
ADD COLUMN "patientId" TEXT,
ADD COLUMN "subject" TEXT,
ADD COLUMN "category" TEXT;

CREATE TABLE "portal_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "emailSnapshot" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_invites_token_key" ON "portal_invites"("token");
CREATE INDEX "portal_invites_clinicId_clientId_idx" ON "portal_invites"("clinicId", "clientId");
CREATE INDEX "portal_invites_token_expiresAt_idx" ON "portal_invites"("token", "expiresAt");
CREATE INDEX "ai_conversations_patientId_idx" ON "ai_conversations"("patientId");

ALTER TABLE "portal_invites"
ADD CONSTRAINT "portal_invites_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portal_invites"
ADD CONSTRAINT "portal_invites_clinicId_fkey"
FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversations"
ADD CONSTRAINT "ai_conversations_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

