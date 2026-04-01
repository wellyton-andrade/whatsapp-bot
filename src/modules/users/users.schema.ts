import { z } from 'zod';

const strongPasswordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
  });

export const createUserSchema = z
  .object({
    tenantId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    password: strongPasswordSchema,
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']).optional(),
    avatarUrl: z.string().trim().url().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    avatarUrl: z.string().trim().url().optional(),
  })
  .strict();

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: strongPasswordSchema,
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
