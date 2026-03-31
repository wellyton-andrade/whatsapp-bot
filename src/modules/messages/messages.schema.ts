import { MessageType } from '@prisma/client';
import { z } from 'zod';

export const templateIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createTemplateSchema = z.object({
  name: z.string().min(2),
  content: z.string().min(1),
  type: z.nativeEnum(MessageType).optional(),
  mediaUrl: z.string().url().optional(),
  caption: z.string().optional(),
  buttons: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).optional(),
  listTitle: z.string().optional(),
  listItems: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
