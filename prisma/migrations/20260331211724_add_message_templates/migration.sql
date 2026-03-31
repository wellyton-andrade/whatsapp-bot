-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'BUTTON_LIST', 'LIST', 'LOCATION');

-- AlterTable
ALTER TABLE "flow_steps" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "caption" TEXT,
    "buttons" JSONB,
    "listTitle" TEXT,
    "listItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_templates_tenantId_idx" ON "message_templates"("tenantId");

-- AddForeignKey
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
