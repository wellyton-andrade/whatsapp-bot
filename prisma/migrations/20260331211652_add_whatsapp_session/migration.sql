-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'BANNED', 'ERROR');

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" "WhatsAppStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "qrCode" TEXT,
    "qrExpiresAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastDisconnectedAt" TIMESTAMP(3),
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_tenantId_key" ON "whatsapp_sessions"("tenantId");

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
