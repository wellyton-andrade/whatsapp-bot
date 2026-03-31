-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'WAITING_INPUT', 'TRANSFERRED', 'FINISHED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "variables" JSONB,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "flowId" TEXT,
    "currentStepId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "mediaUrl" TEXT,
    "waMessageId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_phone_key" ON "contacts"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "conversations_tenantId_idx" ON "conversations"("tenantId");

-- CreateIndex
CREATE INDEX "conversations_contactId_idx" ON "conversations"("contactId");

-- CreateIndex
CREATE INDEX "conversations_tenantId_status_idx" ON "conversations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_messages_waMessageId_idx" ON "conversation_messages"("waMessageId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
