import { z } from 'zod';

export const contactsQuerySchema = z.object({
  search: z.string().optional(),
});
