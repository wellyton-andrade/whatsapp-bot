import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(2),
  content: z.string().min(1),
});
