import { z } from 'zod';

export const createUserSchema = z.object({
  tenantId: z.string().optional(),
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']).optional(),
  avatarUrl: z.url().optional(),
  isActive: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  avatarUrl: z.url().optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
