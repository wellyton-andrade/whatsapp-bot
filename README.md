<h1 align="center">WhatsApp Sales Bot API</h1>

<p align="center">
  Backend multi-tenant para automacao de vendas no WhatsApp com Fastify, Prisma, Redis e BullMQ.
</p>

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" />
  <img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-Queue-EA4AAA" />
</p>

## Visao Geral

Este projeto entrega uma API completa para operacao de bot comercial no WhatsApp, com:

- autenticacao JWT e refresh token rotativo
- arquitetura SaaS multi-tenant
- modulo de WhatsApp com Baileys multi-sessao
- engine de fluxos e passos
- persistencia de conversas e mensagens
- webhooks com API key e retries via BullMQ
- documentacao OpenAPI no Swagger

## Stack Tecnica

<table>
  <tr>
    <td><img src="https://cdn.simpleicons.org/nodedotjs/339933" width="16" /> Runtime</td>
    <td>Node.js 22+</td>
  </tr>
  <tr>
    <td><img src="https://cdn.simpleicons.org/typescript/3178C6" width="16" /> Linguagem</td>
    <td>TypeScript (strict)</td>
  </tr>
  <tr>
    <td><img src="https://cdn.simpleicons.org/fastify/000000" width="16" /> Web</td>
    <td>Fastify</td>
  </tr>
  <tr>
    <td><img src="https://cdn.simpleicons.org/prisma/2D3748" width="16" /> ORM</td>
    <td>Prisma</td>
  </tr>
  <tr>
    <td><img src="https://cdn.simpleicons.org/postgresql/4169E1" width="16" /> Banco</td>
    <td>PostgreSQL</td>
  </tr>
  <tr>
    <td><img src="https://cdn.simpleicons.org/redis/DC382D" width="16" /> Cache/Fila</td>
    <td>Redis + BullMQ</td>
  </tr>
</table>

## Arquitetura

```text
src/
  app.ts
  server.ts
  config/
  modules/
    auth/
    tenants/
    users/
    whatsapp/
    flows/
    messages/
    contacts/
    webhooks/
  shared/
    plugins/
    middlewares/
    queue/
    utils/
prisma/
tests/
```

## Swagger

- URL local: http://localhost:3000/docs
- Especificacao OpenAPI documentada para todos os endpoints atuais
- Security schemes configurados:
  - bearerAuth para JWT
  - apiKeyAuth para ingestao externa de eventos

## Passo a Passo Para Rodar

### 1) Instalar dependencias

```bash
npm install
```

### 2) Subir infraestrutura (Postgres + Redis)

```bash
docker compose up -d bot redis
```

### 3) Aplicar migrations e seed

```bash
npx prisma migrate dev
npx prisma db seed
```

### 4) Subir API

```bash
npm run dev
```

### 5) Validar servicos

- Health check: http://localhost:3000/health
- Swagger UI: http://localhost:3000/docs

## Passo a Passo De Uso Da API

### 1) Autenticar

- POST /auth/login
- Guarde o accessToken retornado

### 2) Criar tenant

- POST /tenants
- Requer JWT com role SUPER_ADMIN

### 3) Criar usuario administrativo

- POST /users

### 4) Conectar WhatsApp

- POST /whatsapp/connect
- GET /whatsapp/status
- POST /whatsapp/send

### 5) Criar fluxo do bot

- POST /flows
- POST /flows/:flowId/steps
- POST /flows/:id/activate

### 6) Criar templates

- POST /message-templates

### 7) Configurar webhooks

- POST /webhooks
- POST /webhooks/api-keys
- POST /webhooks/:id/test

### 8) Ingestao externa (com API key)

- POST /webhooks/events/inbound
- Header obrigatorio: x-api-key

## Endpoints Disponiveis

### System

- GET /health

### Queues

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

### WhatsApp

- POST /whatsapp/connect
- GET /whatsapp/status
- POST /whatsapp/disconnect
- POST /whatsapp/send

### Flows

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

### Message Templates

- POST /message-templates
- GET /message-templates
- GET /message-templates/:id
- PATCH /message-templates/:id
- DELETE /message-templates/:id

### Contacts

- GET /contacts
- GET /contacts/:id
- GET /contacts/:id/history
- DELETE /contacts/:id

### Webhooks

- POST /webhooks
- GET /webhooks
- GET /webhooks/:id
- PATCH /webhooks/:id
- DELETE /webhooks/:id
- POST /webhooks/:id/test
- POST /webhooks/api-keys
- GET /webhooks/api-keys
- POST /webhooks/events/inbound (x-api-key)

## Scripts

```bash
npm run dev
npm run build
npm run start
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Qualidade E CI

- ESLint + Prettier
- Husky pre-commit
- Vitest integracao
- GitHub Actions CI: lint + format + test + build

## Docker

### Subir tudo via compose (app + banco + redis)

```bash
docker compose up -d
```

### Derrubar ambiente

```bash
docker compose down
```

## Licenca

ISC
