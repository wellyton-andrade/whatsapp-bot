import { WebhookEvent } from '@prisma/client';
import { z } from 'zod';

export const webhookIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createWebhookSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
  events: z.array(z.nativeEnum(WebhookEvent)).default([]),
});

export const updateWebhookSchema = createWebhookSchema.partial();

export const testWebhookSchema = z.object({
  event: z.nativeEnum(WebhookEvent).default(WebhookEvent.MESSAGE_RECEIVED),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const inboundWebhookSchema = z
  .object({
    contactPhone: z.string().min(1, 'contactPhone is required'),
    message: z.string().min(1, 'message is required'),
    waMessageId: z.string().optional(),
  })
  .strict(); // Reject extra fields

export const createApiKeySchema = z.object({
  name: z.string().min(2),
  expiresAt: z.string().datetime().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type TestWebhookInput = z.infer<typeof testWebhookSchema>;
export type InboundWebhookInput = z.infer<typeof inboundWebhookSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
