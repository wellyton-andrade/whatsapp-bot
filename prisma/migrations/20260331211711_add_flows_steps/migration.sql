-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('ANY_MESSAGE', 'KEYWORD', 'FIRST_MESSAGE');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('SEND_MESSAGE', 'CAPTURE_INPUT', 'CONDITIONAL', 'END', 'TRANSFER_HUMAN');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'REGEX_MATCH', 'IS_NUMBER');

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "triggerType" "TriggerType" NOT NULL DEFAULT 'ANY_MESSAGE',
    "triggerValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_steps" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "StepType" NOT NULL DEFAULT 'SEND_MESSAGE',
    "inputVariable" TEXT,
    "validationRegex" TEXT,
    "invalidMessage" TEXT,
    "waitForInput" BOOLEAN NOT NULL DEFAULT false,
    "nextStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_conditions" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "nextStepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flows_tenantId_idx" ON "flows"("tenantId");

-- CreateIndex
CREATE INDEX "flows_tenantId_isActive_idx" ON "flows"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "flow_steps_flowId_idx" ON "flow_steps"("flowId");

-- CreateIndex
CREATE INDEX "flow_steps_flowId_order_idx" ON "flow_steps"("flowId", "order");

-- CreateIndex
CREATE INDEX "step_conditions_stepId_idx" ON "step_conditions"("stepId");

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_conditions" ADD CONSTRAINT "step_conditions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "flow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
