import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../../config/env.js';

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
};

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  const document = {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp Sales Bot API',
      description: 'API multi-tenant para bot de vendas no WhatsApp',
      version: '1.0.0',
    },
    servers: [{ url: env.SERVER_URL }],
    tags: [
      { name: 'System' },
      { name: 'Auth' },
      { name: 'Tenants' },
      { name: 'Users' },
      { name: 'WhatsApp' },
      { name: 'Flows' },
      { name: 'Messages' },
      { name: 'Contacts' },
      { name: 'Webhooks' },
      { name: 'Queues' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check da aplicação',
          responses: {
            200: {
              description: 'Aplicação saudável',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      queue: { type: 'string', example: 'enabled' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Autentica usuário',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
                example: {
                  email: 'admin@tenant.com',
                  password: '12345678',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login realizado',
              content: {
                'application/json': {
                  example: {
                    accessToken: '<JWT_ACCESS_TOKEN>',
                    user: {
                      id: 'clx_user_001',
                      name: 'Admin Tenant',
                      email: 'admin@tenant.com',
                      role: 'ADMIN',
                      tenantId: 'clx_tenant_123',
                    },
                  },
                },
              },
            },
            401: {
              description: 'Credenciais inválidas',
              content: { 'application/json': { schema: errorSchema } },
            },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Renova access token',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    refreshToken: { type: 'string' },
                  },
                },
                example: {
                  refreshToken: '<REFRESH_TOKEN>',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Token renovado',
              content: {
                'application/json': {
                  example: { accessToken: '<JWT_ACCESS_TOKEN_RENOVADO>' },
                },
              },
            },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Revoga sessão do refresh token',
          responses: { 204: { description: 'Logout realizado' } },
        },
      },
      '/tenants': {
        post: {
          tags: ['Tenants'],
          summary: 'Cria tenant',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'slug', 'email'],
                  properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    logoUrl: { type: 'string' },
                    plan: { type: 'string', enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] },
                    isActive: { type: 'boolean' },
                  },
                },
                example: {
                  name: 'Acme LTDA',
                  slug: 'acme',
                  email: 'contato@acme.com',
                  plan: 'PRO',
                },
              },
            },
          },
          responses: { 201: { description: 'Tenant criado' } },
        },
        get: {
          tags: ['Tenants'],
          summary: 'Lista tenants',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Lista de tenants' } },
        },
      },
      '/tenants/{id}': {
        get: {
          tags: ['Tenants'],
          summary: 'Detalha tenant',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Tenant' }, 404: { description: 'Não encontrado' } },
        },
        patch: {
          tags: ['Tenants'],
          summary: 'Atualiza tenant',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Tenant atualizado' } },
        },
        delete: {
          tags: ['Tenants'],
          summary: 'Remove tenant',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Tenant removido' } },
        },
      },
      '/users': {
        post: {
          tags: ['Users'],
          summary: 'Cria usuário',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email', 'password'],
                  properties: {
                    tenantId: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                    role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] },
                    avatarUrl: { type: 'string' },
                    isActive: { type: 'boolean' },
                  },
                },
                example: {
                  tenantId: 'clx_tenant_123',
                  name: 'Maria Operadora',
                  email: 'maria@acme.com',
                  password: '12345678',
                  role: 'OPERATOR',
                },
              },
            },
          },
          responses: { 201: { description: 'Usuário criado' } },
        },
      },
      '/users/me': {
        get: {
          tags: ['Users'],
          summary: 'Perfil do usuário autenticado',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Perfil' } },
        },
        patch: {
          tags: ['Users'],
          summary: 'Atualiza perfil',
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    avatarUrl: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Perfil atualizado' } },
        },
      },
      '/users/me/password': {
        patch: {
          tags: ['Users'],
          summary: 'Atualiza senha',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentPassword', 'newPassword'],
                  properties: {
                    currentPassword: { type: 'string' },
                    newPassword: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 204: { description: 'Senha atualizada' } },
        },
      },
      '/whatsapp/connect': {
        post: {
          tags: ['WhatsApp'],
          summary: 'Inicia conexão WhatsApp para tenant',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Conexão iniciada' } },
        },
      },
      '/whatsapp/status': {
        get: {
          tags: ['WhatsApp'],
          summary: 'Consulta status da sessão WhatsApp',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Status da sessão' } },
        },
      },
      '/whatsapp/disconnect': {
        post: {
          tags: ['WhatsApp'],
          summary: 'Desconecta sessão WhatsApp',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Sessão desconectada' } },
        },
      },
      '/whatsapp/send': {
        post: {
          tags: ['WhatsApp'],
          summary: 'Envia mensagem WhatsApp',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'message'],
                  properties: {
                    to: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
                example: {
                  to: '5511999999999',
                  message: 'Olá, seu pedido foi confirmado!',
                },
              },
            },
          },
          responses: { 200: { description: 'Mensagem enviada' } },
        },
      },
      '/flows': {
        post: {
          tags: ['Flows'],
          summary: 'Cria fluxo',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    triggerType: {
                      type: 'string',
                      enum: ['ANY_MESSAGE', 'KEYWORD', 'FIRST_MESSAGE'],
                    },
                    triggerValue: { type: 'string' },
                    isActive: { type: 'boolean' },
                  },
                },
                example: {
                  name: 'Boas-vindas',
                  triggerType: 'FIRST_MESSAGE',
                },
              },
            },
          },
          responses: { 201: { description: 'Fluxo criado' } },
        },
        get: {
          tags: ['Flows'],
          summary: 'Lista fluxos',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Lista de fluxos' } },
        },
      },
      '/flows/{id}': {
        get: {
          tags: ['Flows'],
          summary: 'Detalha fluxo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Fluxo' } },
        },
        patch: {
          tags: ['Flows'],
          summary: 'Atualiza fluxo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Fluxo atualizado' } },
        },
        delete: {
          tags: ['Flows'],
          summary: 'Remove fluxo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Fluxo removido' } },
        },
      },
      '/flows/{id}/activate': {
        post: {
          tags: ['Flows'],
          summary: 'Ativa fluxo para tenant',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Fluxo ativado' } },
        },
      },
      '/flows/{flowId}/steps': {
        post: {
          tags: ['Flows'],
          summary: 'Cria step em fluxo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'flowId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['order'],
                  properties: {
                    templateId: { type: 'string' },
                    order: { type: 'integer' },
                    type: {
                      type: 'string',
                      enum: [
                        'SEND_MESSAGE',
                        'CAPTURE_INPUT',
                        'CONDITIONAL',
                        'END',
                        'TRANSFER_HUMAN',
                      ],
                    },
                    inputVariable: { type: 'string' },
                    waitForInput: { type: 'boolean' },
                    nextStepId: { type: 'string' },
                  },
                },
                example: {
                  order: 1,
                  type: 'SEND_MESSAGE',
                },
              },
            },
          },
          responses: { 201: { description: 'Step criado' } },
        },
        get: {
          tags: ['Flows'],
          summary: 'Lista steps do fluxo',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'flowId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Lista de steps' } },
        },
      },
      '/flows/{flowId}/steps/{stepId}': {
        patch: {
          tags: ['Flows'],
          summary: 'Atualiza step',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'flowId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    order: { type: 'integer' },
                    type: { type: 'string' },
                    inputVariable: { type: 'string' },
                    waitForInput: { type: 'boolean' },
                    nextStepId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Step atualizado' } },
        },
        delete: {
          tags: ['Flows'],
          summary: 'Remove step',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'flowId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stepId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: { 204: { description: 'Step removido' } },
        },
      },
      '/message-templates': {
        post: {
          tags: ['Messages'],
          summary: 'Cria template de mensagem',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'content'],
                  properties: {
                    name: { type: 'string' },
                    content: { type: 'string' },
                    type: {
                      type: 'string',
                      enum: [
                        'TEXT',
                        'IMAGE',
                        'AUDIO',
                        'VIDEO',
                        'DOCUMENT',
                        'BUTTON_LIST',
                        'LIST',
                        'LOCATION',
                      ],
                    },
                  },
                },
                example: {
                  name: 'Boas Vindas',
                  content: 'Olá {{nome}}, seja bem-vindo(a)!',
                  type: 'TEXT',
                },
              },
            },
          },
          responses: { 201: { description: 'Template criado' } },
        },
        get: {
          tags: ['Messages'],
          summary: 'Lista templates',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Lista de templates' } },
        },
      },
      '/message-templates/{id}': {
        get: {
          tags: ['Messages'],
          summary: 'Detalha template',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Template' } },
        },
        patch: {
          tags: ['Messages'],
          summary: 'Atualiza template',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    content: { type: 'string' },
                    type: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Template atualizado' } },
        },
        delete: {
          tags: ['Messages'],
          summary: 'Remove template',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Template removido' } },
        },
      },
      '/contacts': {
        get: {
          tags: ['Contacts'],
          summary: 'Lista contatos',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Lista de contatos' } },
        },
      },
      '/contacts/{id}': {
        get: {
          tags: ['Contacts'],
          summary: 'Detalha contato',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Contato' } },
        },
        delete: {
          tags: ['Contacts'],
          summary: 'Remove contato',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Contato removido' } },
        },
      },
      '/contacts/{id}/history': {
        get: {
          tags: ['Contacts'],
          summary: 'Consulta histórico de conversas',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Histórico' } },
        },
      },
      '/webhooks': {
        post: {
          tags: ['Webhooks'],
          summary: 'Cria webhook',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'url'],
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    secret: { type: 'string' },
                    isActive: { type: 'boolean' },
                    events: { type: 'array', items: { type: 'string' } },
                  },
                },
                example: {
                  name: 'CRM Integration',
                  url: 'https://api.exemplo.com/hooks/whatsapp',
                  events: ['MESSAGE_RECEIVED', 'FLOW_COMPLETED'],
                },
              },
            },
          },
          responses: { 201: { description: 'Webhook criado' } },
        },
        get: {
          tags: ['Webhooks'],
          summary: 'Lista webhooks',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Lista de webhooks' } },
        },
      },
      '/webhooks/{id}': {
        get: {
          tags: ['Webhooks'],
          summary: 'Detalha webhook',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Webhook' } },
        },
        patch: {
          tags: ['Webhooks'],
          summary: 'Atualiza webhook',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Webhook atualizado' } },
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Remove webhook',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 204: { description: 'Webhook removido' } },
        },
      },
      '/webhooks/{id}/test': {
        post: {
          tags: ['Webhooks'],
          summary: 'Enfileira teste de entrega de webhook',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    event: { type: 'string' },
                    payload: { type: 'object', additionalProperties: true },
                  },
                },
                example: {
                  event: 'MESSAGE_RECEIVED',
                  payload: { contactPhone: '5511999999999', message: 'Oi' },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Teste disparado',
              content: { 'application/json': { example: { queued: true, jobId: '78' } } },
            },
          },
        },
      },
      '/webhooks/api-keys': {
        post: {
          tags: ['Webhooks'],
          summary: 'Cria API key para ingestão externa',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
                example: {
                  name: 'Inbound Integrator',
                  expiresAt: '2026-12-31T23:59:59.000Z',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'API key criada',
              content: {
                'application/json': {
                  example: {
                    id: 'clx_key_01',
                    name: 'Inbound Integrator',
                    prefix: 'wk_ab12cd',
                    key: 'wk_ab12cd.xxxxxxxxxxxxxxxxxxxxx',
                  },
                },
              },
            },
          },
        },
        get: {
          tags: ['Webhooks'],
          summary: 'Lista API keys',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Lista de API keys' } },
        },
      },
      '/webhooks/events/inbound': {
        post: {
          tags: ['Webhooks'],
          summary: 'Recebe evento inbound via API key',
          security: [{ apiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['contactPhone', 'message'],
                  properties: {
                    contactPhone: { type: 'string' },
                    message: { type: 'string' },
                    waMessageId: { type: 'string' },
                  },
                },
                example: {
                  contactPhone: '5511988887777',
                  message: 'Oi, quero saber sobre planos',
                  waMessageId: 'BAE5123ABC',
                },
              },
            },
          },
          responses: {
            202: {
              description: 'Evento enfileirado',
              content: {
                'application/json': {
                  example: { jobId: '99' },
                },
              },
            },
          },
        },
      },
      '/queues/sales/test': {
        post: {
          tags: ['Queues'],
          summary: 'Enfileira mensagem de venda',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['tenantId', 'contactPhone', 'message'],
                  properties: {
                    tenantId: { type: 'string' },
                    contactPhone: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
                example: {
                  tenantId: 'clx_tenant_123',
                  contactPhone: '5511999999999',
                  message: 'Olá! Temos uma oferta para você hoje.',
                },
              },
            },
          },
          responses: {
            202: {
              description: 'Mensagem enfileirada',
              content: {
                'application/json': {
                  example: { jobId: '42' },
                },
              },
            },
          },
        },
      },
      '/queues/sales/{jobId}': {
        get: {
          tags: ['Queues'],
          summary: 'Consulta status do job da fila',
          parameters: [{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'Status do job',
              content: {
                'application/json': {
                  example: {
                    status: 'completed',
                    data: {
                      tenantId: 'clx_tenant_123',
                      contactPhone: '5511999999999',
                      message: 'Olá! Temos uma oferta para você hoje.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: document as any,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
