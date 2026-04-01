import { z } from 'zod';

export const connectWhatsAppSchema = z
  .object({
    mode: z.enum(['QR', 'CODE']).default('QR'),
    // E.164 without plus sign: 12345678901
    phoneNumber: z
      .string()
      .regex(/^\d{10,15}$/)
      .optional(),
  })
  .refine((data) => (data.mode === 'CODE' ? Boolean(data.phoneNumber) : true), {
    message: 'phoneNumber is required when mode is CODE',
    path: ['phoneNumber'],
  });

export const sendMessageSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
});
