import { z } from 'zod';

export const contactsQuerySchema = z.object({
  search: z.string().optional(),
});

export const contactIdParamSchema = z.object({
  id: z.string().min(1),
});
