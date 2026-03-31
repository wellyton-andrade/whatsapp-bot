import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
  email: z.email(),
  phone: z.string().optional(),
  logoUrl: z.url().optional(),
  plan: z.enum(['FREE', 'BASIC', 'PRO', 'ENTERPRISE']).optional(),
  isActive: z.boolean().optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const tenantIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
