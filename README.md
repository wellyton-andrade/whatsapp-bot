# WhatsApp Sales Bot

Backend SaaS multi-tenant para automacao de vendas no WhatsApp, com arquitetura modular, autenticação JWT, persistência em PostgreSQL com Prisma, fila assíncrona com BullMQ e cache/infra em Redis.

## Stack

- Node.js
- TypeScript
- Fastify
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Zod
- JWT e cookies HttpOnly
- ESLint e Prettier
- Vitest

## Arquitetura de Pastas

src/
- @types/ : augmentations globais do Fastify
- config/ : validacao de ambiente com Zod
- modules/
  - auth/
  - tenants/
  - users/
  - whatsapp/
  - flows/
  - messages/
  - contacts/
  - webhooks/
- shared/
  - middlewares/
  - plugins/
  - errors/
  - utils/
  - queue/
- jobs/
- app.ts : bootstrap principal da API
- server.ts : entrypoint do servidor
- index.ts : reexport de build/start

Outros diretórios:
- prisma/ : schema, migrations e seed
- tests/ : testes de integracao
- docker-compose.yaml : Postgres + Redis locais

## Funcionalidades Implementadas

- Arquitetura modular pronta para evolucao por dominio.
- Validacao de variaveis de ambiente com Zod.
- Plugins Fastify de seguranca:
  - Helmet
  - CORS
  - Rate limit
  - Swagger e Swagger UI
- Integracao com Prisma e PostgreSQL.
- Integracao com Redis e BullMQ.
- Rotas base de fila:
  - POST /queues/sales/test
  - GET /queues/sales/:jobId
- Health check:
  - GET /health
- Modulo de Auth com:
  - login
  - refresh token rotativo
  - logout
- Modulo de Tenants com CRUD funcional.
- Modulo de Users com:
  - create
  - me
  - update profile
  - update password

## Rotas da API

### Sistema
- GET /health
- POST /queues/sales/test
- GET /queues/sales/:jobId

### Auth
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout

### Tenants
- POST /tenants
- GET /tenants
- GET /tenants/:id
- PATCH /tenants/:id
- DELETE /tenants/:id

### Users
- POST /users
- GET /users/me
- PATCH /users/me
- PATCH /users/me/password

### WhatsApp (placeholder inicial)
- POST /whatsapp/connect
- GET /whatsapp/status
- POST /whatsapp/disconnect
- POST /whatsapp/send

### Flows (placeholder inicial)
- POST /flows
- GET /flows
- GET /flows/:id
- PATCH /flows/:id
- DELETE /flows/:id
- POST /flows/:id/activate
- POST /flows/:flowId/steps
- GET /flows/:flowId/steps
- PATCH /flows/:flowId/steps/:stepId
- DELETE /flows/:flowId/steps/:stepId

### Message Templates (placeholder inicial)
- POST /message-templates
- GET /message-templates
- GET /message-templates/:id
- PATCH /message-templates/:id
- DELETE /message-templates/:id

### Contacts (placeholder inicial)
- GET /contacts
- GET /contacts/:id
- DELETE /contacts/:id

### Webhooks (placeholder inicial)
- POST /webhooks
- GET /webhooks
- GET /webhooks/:id
- PATCH /webhooks/:id
- DELETE /webhooks/:id

## Banco de Dados

O schema Prisma inclui as entidades principais do produto multi-tenant:

- Tenant
- User
- RefreshToken
- WhatsAppSession
- Flow
- FlowStep
- StepCondition
- MessageTemplate
- Contact
- Conversation
- ConversationMessage
- Webhook
- WebhookDelivery
- ApiKey

Enums principais:
- Plan
- UserRole
- WhatsAppStatus
- TriggerType
- StepType
- ConditionOperator
- MessageType
- ConversationStatus
- Direction
- MessageStatus
- WebhookEvent

## Variaveis de Ambiente

Este projeto usa arquivo .env versionado no repositório.

Campos atuais esperados:

- NODE_ENV
- PORT
- HOST
- SERVER_URL
- CORS_ORIGINS
- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME
- DATABASE_URL
- REDIS_HOST
- REDIS_PORT
- REDIS_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- JWT_REFRESH_EXPIRES_IN_DAYS

## Como Rodar Localmente

1) Instalar dependencias
- npm install

2) Subir infraestrutura local
- docker compose up -d

3) Rodar migrations (se necessario)
- npx prisma migrate dev

4) Rodar seed (opcional)
- npx prisma db seed

5) Rodar API em desenvolvimento
- npm run dev

Servidor:
- http://localhost:3000

Documentacao Swagger:
- http://localhost:3000/docs

## Scripts NPM

- npm run dev : sobe API em desenvolvimento
- npm run build : compila TypeScript
- npm run start : executa build em dist
- npm test : executa testes com Vitest
- npm run lint : valida lint
- npm run lint:fix : corrige lint automaticamente
- npm run format : formata codigo com Prettier
- npm run format:check : valida formatacao

## Qualidade de Código

ESLint e Prettier estao configurados no projeto.

Arquivos relevantes:
- eslint.config.js
- .prettierrc
- .prettierignore

## Testes

Suite atual:
- tests/integration/server.test.ts

Cobertura inicial validada:
- Rate limiting no endpoint de health.

## Redis e BullMQ

Fila implementada em:
- src/shared/queue/salesQueue.ts

Fluxo inicial:
- Enfileirar job de mensagem de venda
- Worker processa e marca estado
- Endpoint consulta status do job

## Segurança

- JWT com access token e refresh token rotativo
- Refresh token via cookie HttpOnly
- Middleware de autenticacao
- Middleware de resolucao de tenant
- Middleware de autorizacao por roles
- Helmet
- CORS configuravel por env
- Rate limiting

## Infra Docker

docker-compose.yaml sobe:
- postgres:17-alpine
- redis:7-alpine

Healthchecks incluidos para ambos.

## Estado Atual do Projeto

Pronto para desenvolvimento incremental por fases.

Ja implementado com comportamento real:
- Auth
- Tenants
- Users
- Infra e qualidade

Modulos restantes estao com rotas/estrutura base para evolucao:
- WhatsApp
- Flows
- Messages
- Contacts
- Webhooks

## Próximos Passos Sugeridos

- Integrar Baileys multi-sessao no modulo whatsapp.
- Implementar engine de fluxo em flows.
- Persistir estado de conversa no Redis.
- Implementar webhooks com retry na BullMQ.
- Aumentar cobertura de testes unitarios e de integracao.

## Licença

ISC
