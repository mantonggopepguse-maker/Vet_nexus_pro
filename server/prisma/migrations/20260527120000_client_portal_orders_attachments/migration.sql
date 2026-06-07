ALTER TABLE "clients"
ADD COLUMN "portalPasswordMustChange" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ai_message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_message_attachments_messageId_idx" ON "ai_message_attachments"("messageId");

ALTER TABLE "ai_message_attachments"
ADD CONSTRAINT "ai_message_attachments_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
