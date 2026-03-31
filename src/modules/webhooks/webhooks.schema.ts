import { z } from 'zod';

export const createWebhookSchema = z.object({
  name: z.string().min(2),
  url: z.url(),
});
