import { z } from 'zod';

export const sendMessageSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
});
