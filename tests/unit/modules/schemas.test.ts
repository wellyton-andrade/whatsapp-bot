import { describe, expect, test } from 'vitest';
import { TriggerType, StepType, MessageType, WebhookEvent } from '@prisma/client';
import { loginSchema, refreshSchema } from '../../../src/modules/auth/auth.schema';
import { createUserSchema, updatePasswordSchema } from '../../../src/modules/users/users.schema';
import {
  createTenantSchema,
  tenantIdParamSchema,
} from '../../../src/modules/tenants/tenants.schema';
import { createFlowSchema, createStepSchema } from '../../../src/modules/flows/flows.schema';
import { createTemplateSchema } from '../../../src/modules/messages/messages.schema';
import {
  createWebhookSchema,
  createApiKeySchema,
  testWebhookSchema,
} from '../../../src/modules/webhooks/webhooks.schema';
import {
  connectWhatsAppSchema,
  sendMessageSchema,
} from '../../../src/modules/whatsapp/whatsapp.schema';
import {
  contactIdParamSchema,
  contactsQuerySchema,
} from '../../../src/modules/contacts/contacts.schema';

describe('Schemas Unit Tests', () => {
  test('loginSchema should validate valid login payload', () => {
    const parsed = loginSchema.parse({ email: 'admin@example.com', password: '123456' });
    expect(parsed.email).toBe('admin@example.com');
  });

  test('loginSchema should reject invalid email', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: '123456' });
    expect(result.success).toBe(false);
  });

  test('refreshSchema should accept empty object', () => {
    const parsed = refreshSchema.parse({});
    expect(parsed.refreshToken).toBeUndefined();
  });

  test('createUserSchema should reject short password', () => {
    const result = createUserSchema.safeParse({
      name: 'Maria',
      email: 'maria@example.com',
      password: '123',
    });

    expect(result.success).toBe(false);
  });

  test('updatePasswordSchema should require both passwords', () => {
    const result = updatePasswordSchema.safeParse({ currentPassword: '12345678' });
    expect(result.success).toBe(false);
  });

  test('createTenantSchema should reject invalid slug format', () => {
    const result = createTenantSchema.safeParse({
      name: 'Tenant',
      slug: 'Invalid Slug',
      email: 'tenant@example.com',
    });

    expect(result.success).toBe(false);
  });

  test('tenantIdParamSchema should validate id', () => {
    const parsed = tenantIdParamSchema.parse({ id: 'tenant-id' });
    expect(parsed.id).toBe('tenant-id');
  });

  test('createFlowSchema should validate trigger type enum', () => {
    const parsed = createFlowSchema.parse({
      name: 'Fluxo',
      triggerType: TriggerType.FIRST_MESSAGE,
    });

    expect(parsed.triggerType).toBe(TriggerType.FIRST_MESSAGE);
  });

  test('createStepSchema should reject negative order', () => {
    const result = createStepSchema.safeParse({ order: -1, type: StepType.SEND_MESSAGE });
    expect(result.success).toBe(false);
  });

  test('createTemplateSchema should validate optional enum type', () => {
    const parsed = createTemplateSchema.parse({
      name: 'Boas vindas',
      content: 'Olá {{nome}}',
      type: MessageType.TEXT,
    });

    expect(parsed.type).toBe(MessageType.TEXT);
  });

  test('createWebhookSchema should default events to empty array', () => {
    const parsed = createWebhookSchema.parse({
      name: 'Webhook',
      url: 'https://example.com/hook',
    });

    expect(parsed.events).toEqual([]);
  });

  test('createApiKeySchema should reject invalid datetime', () => {
    const result = createApiKeySchema.safeParse({
      name: 'My key',
      expiresAt: 'not-a-date',
    });

    expect(result.success).toBe(false);
  });

  test('testWebhookSchema should apply default event and payload', () => {
    const parsed = testWebhookSchema.parse({});
    expect(parsed.event).toBe(WebhookEvent.MESSAGE_RECEIVED);
    expect(parsed.payload).toEqual({});
  });

  test('connectWhatsAppSchema should require phoneNumber when mode is CODE', () => {
    const result = connectWhatsAppSchema.safeParse({ mode: 'CODE' });
    expect(result.success).toBe(false);
  });

  test('connectWhatsAppSchema should accept QR mode without phoneNumber', () => {
    const parsed = connectWhatsAppSchema.parse({ mode: 'QR' });
    expect(parsed.mode).toBe('QR');
    expect(parsed.phoneNumber).toBeUndefined();
  });

  test('sendMessageSchema should reject short destination', () => {
    const result = sendMessageSchema.safeParse({ to: '123', message: 'oi' });
    expect(result.success).toBe(false);
  });

  test('contacts schemas should validate query and params', () => {
    const query = contactsQuerySchema.parse({ search: 'joao' });
    const params = contactIdParamSchema.parse({ id: 'contact-1' });

    expect(query.search).toBe('joao');
    expect(params.id).toBe('contact-1');
  });
});
