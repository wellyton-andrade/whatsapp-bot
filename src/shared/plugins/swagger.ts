import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from '../../config/env.js';

// ─────────────────────────────────────────────
// Schemas reutilizáveis
// ─────────────────────────────────────────────

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
  },
} as const;

// ─────────────────────────────────────────────
// Parâmetros de header reutilizáveis
// ─────────────────────────────────────────────

const authorizationHeader = {
  name: 'Authorization',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Obrigatório. Exemplo: `Bearer <JWT_ACCESS_TOKEN>`',
} as const;

const refreshCookieHeader = {
  name: 'Cookie',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Obrigatório. Exemplo: `refreshToken=<valor>`',
} as const;

const optionalRefreshCookieHeader = {
  name: 'Cookie',
  in: 'header',
  required: false,
  schema: { type: 'string' },
  description: 'Opcional. Exemplo: `refreshToken=<valor>`',
} as const;

const apiKeyHeader = {
  name: 'x-api-key',
  in: 'header',
  required: true,
  schema: { type: 'string' },
  description: 'Obrigatório. API key de integração externa.',
} as const;

const idPathParam = (name = 'id') =>
  ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }) as const;

// ─────────────────────────────────────────────
// Respostas reutilizáveis
// ─────────────────────────────────────────────

const responses = {
  204: { description: 'Sem conteúdo' },
  401: {
    description: 'Não autenticado — token ausente ou expirado',
    content: { 'application/json': { schema: errorSchema } },
  },
  403: {
    description: 'Sem permissão — role insuficiente',
    content: { 'application/json': { schema: errorSchema } },
  },
  404: {
    description: 'Recurso não encontrado',
    content: { 'application/json': { schema: errorSchema } },
  },
} as const;

// ─────────────────────────────────────────────
// Enums do domínio
// ─────────────────────────────────────────────

const planEnum = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const;
const userRoleEnum = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] as const;
const whatsappStatusEnum = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'BANNED', 'ERROR'] as const;
const triggerTypeEnum = ['ANY_MESSAGE', 'KEYWORD', 'FIRST_MESSAGE'] as const;
const stepTypeEnum = [
  'SEND_MESSAGE',
  'CAPTURE_INPUT',
  'CONDITIONAL',
  'END',
  'TRANSFER_HUMAN',
] as const;
const messageTypeEnum = [
  'TEXT',
  'IMAGE',
  'AUDIO',
  'VIDEO',
  'DOCUMENT',
  'BUTTON_LIST',
  'LIST',
  'LOCATION',
] as const;
const jobStatusEnum = ['waiting', 'active', 'completed', 'failed', 'delayed', 'not_found'] as const;

// ─────────────────────────────────────────────
// Registro do Swagger
// ─────────────────────────────────────────────

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: {
        openapi: '3.0.3',

        // ── Informações gerais ──────────────────
        info: {
          title: 'WhatsApp Sales Bot API',
          version: '1.0.0',
          description: [
            'API multi-tenant para bot de vendas no WhatsApp.',
            '',
            '## Autenticação',
            '- **Bearer JWT**: envie `Authorization: Bearer <access_token>` em rotas protegidas.',
            '- **Refresh Token**: cookie HttpOnly `refreshToken` nas rotas `/auth/refresh` e `/auth/logout`.',
            '- **API Key**: header `x-api-key` para integrações externas (inbound events).',
            '',
            '> O `access_token` expira em **15 minutos**. Use `/auth/refresh` para renová-lo silenciosamente.',
          ].join('\n'),
        },

        servers: [{ url: env.SERVER_URL, description: 'Servidor principal' }],

        // ── Tags (ordem no Swagger UI) ──────────
        tags: [
          { name: 'System', description: 'Health check e status da aplicação' },
          { name: 'Auth', description: 'Login, logout e renovação de tokens' },
          { name: 'Tenants', description: 'Gestão de negócios (SUPER_ADMIN)' },
          { name: 'Users', description: 'Usuários do painel administrativo' },
          { name: 'WhatsApp', description: 'Conexão e envio de mensagens via WhatsApp' },
          { name: 'Flows', description: 'Fluxos de conversa e steps do bot' },
          { name: 'Messages', description: 'Templates de mensagem com variáveis dinâmicas' },
          { name: 'Contacts', description: 'Contatos e histórico de conversas' },
          { name: 'Webhooks', description: 'Webhooks, API keys e eventos externos' },
          { name: 'Queues', description: 'Gerenciamento da fila BullMQ' },
        ],

        // ── Segurança global ────────────────────
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: '`Authorization: Bearer <access_token>`',
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
              description: '`x-api-key: <api_key>` — integrações externas',
            },
          },

          schemas: {
            Error: errorSchema,

            Tenant: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                slug: { type: 'string' },
                email: { type: 'string', format: 'email' },
                phone: { type: 'string', nullable: true },
                logoUrl: { type: 'string', nullable: true },
                isActive: { type: 'boolean' },
                plan: { type: 'string', enum: [...planEnum] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },

            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string', nullable: true },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', enum: [...userRoleEnum] },
                avatarUrl: { type: 'string', nullable: true },
                isActive: { type: 'boolean' },
                lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },

            WhatsAppSession: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string' },
                phoneNumber: { type: 'string', nullable: true },
                status: { type: 'string', enum: [...whatsappStatusEnum] },
                qrCode: {
                  type: 'string',
                  nullable: true,
                  description: 'Base64 do QR code (válido por 60s)',
                },
                qrExpiresAt: { type: 'string', format: 'date-time', nullable: true },
                lastConnectedAt: { type: 'string', format: 'date-time', nullable: true },
                lastDisconnectedAt: { type: 'string', format: 'date-time', nullable: true },
              },
            },

            Flow: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                triggerType: { type: 'string', enum: [...triggerTypeEnum] },
                triggerValue: { type: 'string', nullable: true },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },

            FlowStep: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                flowId: { type: 'string' },
                templateId: { type: 'string', nullable: true },
                order: { type: 'integer' },
                type: { type: 'string', enum: [...stepTypeEnum] },
                inputVariable: { type: 'string', nullable: true },
                waitForInput: { type: 'boolean' },
                nextStepId: { type: 'string', nullable: true },
              },
            },

            MessageTemplate: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string' },
                name: { type: 'string' },
                content: { type: 'string', description: 'Suporta variáveis como `{{nome}}`' },
                type: { type: 'string', enum: [...messageTypeEnum] },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },

            Contact: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string' },
                phone: { type: 'string' },
                name: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },

            Webhook: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'string' },
                name: { type: 'string' },
                url: { type: 'string', format: 'uri' },
                isActive: { type: 'boolean' },
                events: { type: 'array', items: { type: 'string' } },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },

        // ─────────────────────────────────────────
        // PATHS
        // ─────────────────────────────────────────
        paths: {
          // ══════════════════════════════════════
          // SYSTEM
          // ══════════════════════════════════════

          '/health': {
            get: {
              tags: ['System'],
              summary: 'Health check da aplicação',
              description:
                'Verifica se a API e a fila BullMQ estão operacionais. Não requer autenticação.',
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

          // ══════════════════════════════════════
          // AUTH
          // ══════════════════════════════════════

          '/auth/login': {
            post: {
              tags: ['Auth'],
              summary: 'Autenticar usuário',
              description:
                'Autentica com email e senha. Retorna `accessToken` no body e define o cookie HttpOnly `refreshToken` para renovação de sessão.',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                      },
                    },
                    example: { email: 'admin@tenant.com', password: '12345678' },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Login realizado com sucesso',
                  headers: {
                    'Set-Cookie': {
                      schema: { type: 'string' },
                      description: 'Cookie HttpOnly `refreshToken` definido pelo servidor',
                    },
                  },
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          accessToken: { type: 'string' },
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
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
                401: responses[401],
              },
            },
          },

          '/auth/refresh': {
            post: {
              tags: ['Auth'],
              summary: 'Renovar access token',
              description:
                'Aceita o `refreshToken` via cookie HttpOnly **ou** body. O token antigo é invalidado (rotativo). Retorna novo `accessToken` e renova o cookie.',
              parameters: [optionalRefreshCookieHeader],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        refreshToken: { type: 'string', description: 'Alternativa ao cookie' },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Token renovado',
                  headers: {
                    'Set-Cookie': {
                      schema: { type: 'string' },
                      description: 'Novo cookie `refreshToken` HttpOnly',
                    },
                  },
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: { accessToken: { type: 'string' } },
                      },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/auth/logout': {
            post: {
              tags: ['Auth'],
              summary: 'Encerrar sessão',
              description:
                'Revoga o `refreshToken` no banco e limpa o cookie da sessão. Requer o cookie `refreshToken`.',
              parameters: [refreshCookieHeader],
              responses: {
                204: { description: 'Logout realizado com sucesso' },
                401: responses[401],
              },
            },
          },

          // ══════════════════════════════════════
          // TENANTS
          // ══════════════════════════════════════

          '/tenants': {
            post: {
              tags: ['Tenants'],
              summary: 'Criar tenant',
              description: 'Cria um novo negócio na plataforma. **Requer role `SUPER_ADMIN`.**',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'slug', 'email'],
                      properties: {
                        name: { type: 'string' },
                        slug: {
                          type: 'string',
                          description: 'Identificador único URL-friendly. Ex: `loja-do-joao`',
                        },
                        email: { type: 'string', format: 'email' },
                        phone: { type: 'string' },
                        logoUrl: { type: 'string', format: 'uri' },
                        plan: { type: 'string', enum: [...planEnum], default: 'FREE' },
                        isActive: { type: 'boolean', default: true },
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
              responses: {
                201: {
                  description: 'Tenant criado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Tenant' } },
                  },
                },
                401: responses[401],
                403: responses[403],
              },
            },
            get: {
              tags: ['Tenants'],
              summary: 'Listar tenants',
              description: 'Lista todos os tenants da plataforma. **Requer role `SUPER_ADMIN`.**',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Lista de tenants',
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { $ref: '#/components/schemas/Tenant' } },
                    },
                  },
                },
                401: responses[401],
                403: responses[403],
              },
            },
          },

          '/tenants/{id}': {
            get: {
              tags: ['Tenants'],
              summary: 'Detalhar tenant',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Tenant encontrado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Tenant' } },
                  },
                },
                401: responses[401],
                403: responses[403],
                404: responses[404],
              },
            },
            patch: {
              tags: ['Tenants'],
              summary: 'Atualizar tenant',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
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
                        plan: { type: 'string', enum: [...planEnum] },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Tenant atualizado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Tenant' } },
                  },
                },
                401: responses[401],
                403: responses[403],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Tenants'],
              summary: 'Remover tenant',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                403: responses[403],
                404: responses[404],
              },
            },
          },

          // ══════════════════════════════════════
          // USERS
          // ══════════════════════════════════════

          '/users': {
            post: {
              tags: ['Users'],
              summary: 'Criar usuário',
              description: 'Cria um usuário no tenant. **Requer role `ADMIN` ou superior.**',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'email', 'password'],
                      properties: {
                        tenantId: {
                          type: 'string',
                          description: 'Obrigatório para SUPER_ADMIN; inferido do token para ADMIN',
                        },
                        name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 },
                        role: { type: 'string', enum: [...userRoleEnum], default: 'ADMIN' },
                        avatarUrl: { type: 'string', format: 'uri' },
                        isActive: { type: 'boolean', default: true },
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
              responses: {
                201: {
                  description: 'Usuário criado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/User' } },
                  },
                },
                401: responses[401],
                403: responses[403],
              },
            },
          },

          '/users/me': {
            get: {
              tags: ['Users'],
              summary: 'Meu perfil',
              description: 'Retorna os dados do usuário autenticado.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Perfil do usuário',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/User' } },
                  },
                },
                401: responses[401],
              },
            },
            patch: {
              tags: ['Users'],
              summary: 'Atualizar perfil',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        avatarUrl: { type: 'string', format: 'uri' },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Perfil atualizado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/User' } },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/users/me/password': {
            patch: {
              tags: ['Users'],
              summary: 'Alterar senha',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['currentPassword', 'newPassword'],
                      properties: {
                        currentPassword: { type: 'string' },
                        newPassword: { type: 'string', minLength: 8 },
                      },
                    },
                  },
                },
              },
              responses: {
                204: responses[204],
                401: responses[401],
              },
            },
          },

          // ══════════════════════════════════════
          // WHATSAPP
          // ══════════════════════════════════════

          '/whatsapp/connect': {
            post: {
              tags: ['WhatsApp'],
              summary: 'Iniciar conexão',
              description:
                'Inicia o processo de conexão ao WhatsApp para o tenant do token. Retorna o QR code em base64 (válido por 60s) enquanto aguarda o scan.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Conexão iniciada',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/WhatsAppSession' },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/whatsapp/status': {
            get: {
              tags: ['WhatsApp'],
              summary: 'Status da sessão',
              description: `Consulta o status atual da sessão WhatsApp do tenant. Status possíveis: ${whatsappStatusEnum.map((s) => `\`${s}\``).join(' · ')}.`,
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Status atual',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/WhatsAppSession' },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/whatsapp/disconnect': {
            post: {
              tags: ['WhatsApp'],
              summary: 'Desconectar sessão',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: { description: 'Sessão desconectada com sucesso' },
                401: responses[401],
              },
            },
          },

          '/whatsapp/send': {
            post: {
              tags: ['WhatsApp'],
              summary: 'Enviar mensagem manual',
              description: 'Envia uma mensagem diretamente para um número, fora do fluxo do bot.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['to', 'message'],
                      properties: {
                        to: { type: 'string', description: 'Número com DDI. Ex: `5511999999999`' },
                        message: { type: 'string' },
                      },
                    },
                    example: { to: '5511999999999', message: 'Olá, seu pedido foi confirmado!' },
                  },
                },
              },
              responses: {
                200: { description: 'Mensagem enviada' },
                401: responses[401],
              },
            },
          },

          // ══════════════════════════════════════
          // FLOWS
          // ══════════════════════════════════════

          '/flows': {
            post: {
              tags: ['Flows'],
              summary: 'Criar fluxo',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'triggerType'],
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        triggerType: { type: 'string', enum: [...triggerTypeEnum] },
                        triggerValue: {
                          type: 'string',
                          description: 'Obrigatório quando `triggerType` = `KEYWORD`',
                        },
                        isActive: { type: 'boolean', default: false },
                      },
                    },
                    example: { name: 'Boas-vindas', triggerType: 'FIRST_MESSAGE' },
                  },
                },
              },
              responses: {
                201: {
                  description: 'Fluxo criado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Flow' } },
                  },
                },
                401: responses[401],
              },
            },
            get: {
              tags: ['Flows'],
              summary: 'Listar fluxos',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Lista de fluxos do tenant',
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { $ref: '#/components/schemas/Flow' } },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/flows/{id}': {
            get: {
              tags: ['Flows'],
              summary: 'Detalhar fluxo',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Fluxo encontrado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Flow' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            patch: {
              tags: ['Flows'],
              summary: 'Atualizar fluxo',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
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
              responses: {
                200: {
                  description: 'Fluxo atualizado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Flow' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Flows'],
              summary: 'Remover fluxo',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          '/flows/{id}/activate': {
            post: {
              tags: ['Flows'],
              summary: 'Ativar fluxo',
              description:
                'Ativa o fluxo e desativa todos os outros fluxos do mesmo `triggerType` no tenant.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          '/flows/{flowId}/steps': {
            post: {
              tags: ['Flows'],
              summary: 'Criar step',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam('flowId')],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['order', 'type'],
                      properties: {
                        templateId: {
                          type: 'string',
                          description: 'ID do MessageTemplate a usar neste step',
                        },
                        order: { type: 'integer', minimum: 1 },
                        type: { type: 'string', enum: [...stepTypeEnum] },
                        inputVariable: {
                          type: 'string',
                          description: 'Nome da variável onde salvar a resposta do usuário',
                        },
                        waitForInput: { type: 'boolean', default: false },
                        nextStepId: {
                          type: 'string',
                          nullable: true,
                          description: 'ID do próximo step (null = fim do fluxo)',
                        },
                      },
                    },
                    example: { order: 1, type: 'SEND_MESSAGE', templateId: 'clx_tmpl_001' },
                  },
                },
              },
              responses: {
                201: {
                  description: 'Step criado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/FlowStep' } },
                  },
                },
                401: responses[401],
                404: { description: 'Fluxo não encontrado' },
              },
            },
            get: {
              tags: ['Flows'],
              summary: 'Listar steps do fluxo',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam('flowId')],
              responses: {
                200: {
                  description: 'Steps ordenados',
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { $ref: '#/components/schemas/FlowStep' } },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/flows/{flowId}/steps/{stepId}': {
            patch: {
              tags: ['Flows'],
              summary: 'Atualizar step',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam('flowId'), idPathParam('stepId')],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        order: { type: 'integer', minimum: 1 },
                        type: { type: 'string', enum: [...stepTypeEnum] },
                        inputVariable: { type: 'string' },
                        waitForInput: { type: 'boolean' },
                        nextStepId: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Step atualizado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/FlowStep' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Flows'],
              summary: 'Remover step',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam('flowId'), idPathParam('stepId')],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          // ══════════════════════════════════════
          // MESSAGE TEMPLATES
          // ══════════════════════════════════════

          '/message-templates': {
            post: {
              tags: ['Messages'],
              summary: 'Criar template',
              description:
                'Cria um template de mensagem. Use `{{nome_variavel}}` no conteúdo para variáveis dinâmicas interpoladas em tempo de execução pelo bot engine.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
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
                        type: { type: 'string', enum: [...messageTypeEnum], default: 'TEXT' },
                      },
                    },
                    example: {
                      name: 'Boas Vindas',
                      content: 'Olá {{nome}}, bem-vindo(a) à {{empresa}}!',
                      type: 'TEXT',
                    },
                  },
                },
              },
              responses: {
                201: {
                  description: 'Template criado',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/MessageTemplate' },
                    },
                  },
                },
                401: responses[401],
              },
            },
            get: {
              tags: ['Messages'],
              summary: 'Listar templates',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Templates do tenant',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/MessageTemplate' },
                      },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/message-templates/{id}': {
            get: {
              tags: ['Messages'],
              summary: 'Detalhar template',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Template encontrado',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/MessageTemplate' },
                    },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            patch: {
              tags: ['Messages'],
              summary: 'Atualizar template',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        content: { type: 'string' },
                        type: { type: 'string', enum: [...messageTypeEnum] },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Template atualizado',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/MessageTemplate' },
                    },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Messages'],
              summary: 'Remover template',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          // ══════════════════════════════════════
          // CONTACTS
          // ══════════════════════════════════════

          '/contacts': {
            get: {
              tags: ['Contacts'],
              summary: 'Listar contatos',
              description:
                'Lista os contatos do tenant. Suporta busca por nome ou telefone via `?search=`.',
              security: [{ bearerAuth: [] }],
              parameters: [
                authorizationHeader,
                {
                  name: 'search',
                  in: 'query',
                  required: false,
                  schema: { type: 'string' },
                  description: 'Busca por nome ou telefone',
                },
              ],
              responses: {
                200: {
                  description: 'Lista de contatos',
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { $ref: '#/components/schemas/Contact' } },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/contacts/{id}': {
            get: {
              tags: ['Contacts'],
              summary: 'Detalhar contato',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Contato encontrado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Contact' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Contacts'],
              summary: 'Remover contato',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          '/contacts/{id}/history': {
            get: {
              tags: ['Contacts'],
              summary: 'Histórico de conversas',
              description: 'Retorna todas as conversas e mensagens do contato com o bot.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Histórico de conversas',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            startedAt: { type: 'string', format: 'date-time' },
                            endedAt: { type: 'string', format: 'date-time', nullable: true },
                            messages: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  direction: { type: 'string', enum: ['INBOUND', 'OUTBOUND'] },
                                  content: { type: 'string' },
                                  sentAt: { type: 'string', format: 'date-time' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
          },

          // ══════════════════════════════════════
          // WEBHOOKS
          // ══════════════════════════════════════

          '/webhooks': {
            post: {
              tags: ['Webhooks'],
              summary: 'Criar webhook',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
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
                        secret: {
                          type: 'string',
                          description: 'Usado para assinar o payload (HMAC-SHA256)',
                        },
                        isActive: { type: 'boolean', default: true },
                        events: {
                          type: 'array',
                          items: { type: 'string' },
                          example: ['MESSAGE_RECEIVED', 'FLOW_COMPLETED'],
                        },
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
              responses: {
                201: {
                  description: 'Webhook criado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Webhook' } },
                  },
                },
                401: responses[401],
              },
            },
            get: {
              tags: ['Webhooks'],
              summary: 'Listar webhooks',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: {
                  description: 'Webhooks do tenant',
                  content: {
                    'application/json': {
                      schema: { type: 'array', items: { $ref: '#/components/schemas/Webhook' } },
                    },
                  },
                },
                401: responses[401],
              },
            },
          },

          '/webhooks/{id}': {
            get: {
              tags: ['Webhooks'],
              summary: 'Detalhar webhook',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                200: {
                  description: 'Webhook encontrado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Webhook' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            patch: {
              tags: ['Webhooks'],
              summary: 'Atualizar webhook',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        url: { type: 'string', format: 'uri' },
                        isActive: { type: 'boolean' },
                        events: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: 'Webhook atualizado',
                  content: {
                    'application/json': { schema: { $ref: '#/components/schemas/Webhook' } },
                  },
                },
                401: responses[401],
                404: responses[404],
              },
            },
            delete: {
              tags: ['Webhooks'],
              summary: 'Remover webhook',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              responses: {
                204: responses[204],
                401: responses[401],
                404: responses[404],
              },
            },
          },

          '/webhooks/{id}/test': {
            post: {
              tags: ['Webhooks'],
              summary: 'Testar entrega',
              description:
                'Enfileira um job de teste para validar a entrega do webhook. O resultado pode ser consultado via `/queues/sales/:jobId`.',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader, idPathParam()],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        event: { type: 'string', example: 'MESSAGE_RECEIVED' },
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
                  description: 'Teste enfileirado',
                  content: { 'application/json': { example: { queued: true, jobId: '78' } } },
                },
                401: responses[401],
                404: responses[404],
              },
            },
          },

          '/webhooks/api-keys': {
            post: {
              tags: ['Webhooks'],
              summary: 'Criar API key',
              description:
                'Gera uma nova API key para integrações externas. **A `key` completa é retornada apenas na criação — armazene-a com segurança.**',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string' },
                        expiresAt: {
                          type: 'string',
                          format: 'date-time',
                          description: 'Opcional. Sem valor = sem expiração.',
                        },
                      },
                    },
                    example: { name: 'Inbound Integrator', expiresAt: '2026-12-31T23:59:59.000Z' },
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
                401: responses[401],
              },
            },
            get: {
              tags: ['Webhooks'],
              summary: 'Listar API keys',
              security: [{ bearerAuth: [] }],
              parameters: [authorizationHeader],
              responses: {
                200: { description: 'Lista de API keys (sem o valor completo da key)' },
                401: responses[401],
              },
            },
          },

          '/webhooks/events/inbound': {
            post: {
              tags: ['Webhooks'],
              summary: 'Receber evento externo',
              description:
                'Endpoint para integrações externas injetarem eventos no bot. Usa `x-api-key` em vez de JWT. O evento é enfileirado no BullMQ para processamento assíncrono.',
              security: [{ apiKeyAuth: [] }],
              parameters: [apiKeyHeader],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['contactPhone', 'message'],
                      properties: {
                        contactPhone: {
                          type: 'string',
                          description: 'Número com DDI. Ex: `5511988887777`',
                        },
                        message: { type: 'string' },
                        waMessageId: {
                          type: 'string',
                          description: 'ID da mensagem original no WA (opcional)',
                        },
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
                  description: 'Evento enfileirado com sucesso',
                  content: { 'application/json': { example: { jobId: '99' } } },
                },
                401: responses[401],
              },
            },
          },

          // ══════════════════════════════════════
          // QUEUES
          // ══════════════════════════════════════

          '/queues/sales/test': {
            post: {
              tags: ['Queues'],
              summary: 'Enfileirar mensagem de teste',
              description:
                'Enfileira manualmente uma mensagem de venda para fins de desenvolvimento e testes.',
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
                  content: { 'application/json': { example: { jobId: '42' } } },
                },
              },
            },
          },

          '/queues/sales/{jobId}': {
            get: {
              tags: ['Queues'],
              summary: 'Status do job',
              description: `Consulta o estado atual de um job na fila BullMQ. Status possíveis: ${jobStatusEnum.map((s) => `\`${s}\``).join(' · ')}.`,
              parameters: [idPathParam('jobId')],
              responses: {
                200: {
                  description: 'Status do job',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: [...jobStatusEnum] },
                          data: {
                            nullable: true,
                            type: 'object',
                            properties: {
                              tenantId: { type: 'string' },
                              contactPhone: { type: 'string' },
                              message: { type: 'string' },
                            },
                          },
                        },
                      },
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
      } as any,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'none', // colapsa tudo por padrão
      deepLinking: true, // links diretos para operações
      displayRequestDuration: true,
      persistAuthorization: true, // mantém o token ao recarregar
    },
  });
}
