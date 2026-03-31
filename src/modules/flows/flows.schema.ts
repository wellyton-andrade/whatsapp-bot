import { StepType, TriggerType } from '@prisma/client';
import { z } from 'zod';

export const flowIdParamSchema = z.object({
  id: z.string().min(1),
});

export const flowOnlyParamSchema = z.object({
  flowId: z.string().min(1),
});

export const flowStepParamSchema = z.object({
  flowId: z.string().min(1),
  stepId: z.string().min(1),
});

export const createFlowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  triggerType: z.nativeEnum(TriggerType).optional(),
  triggerValue: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateFlowSchema = createFlowSchema.partial();

export const createStepSchema = z.object({
  templateId: z.string().optional(),
  order: z.number().int().min(0),
  type: z.nativeEnum(StepType).optional(),
  inputVariable: z.string().optional(),
  validationRegex: z.string().optional(),
  invalidMessage: z.string().optional(),
  waitForInput: z.boolean().optional(),
  nextStepId: z.string().optional(),
});

export const updateStepSchema = createStepSchema.partial();

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type CreateStepInput = z.infer<typeof createStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
