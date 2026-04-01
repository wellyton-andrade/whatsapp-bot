<h1 align="center">
  <br />
  🤖 WhatsApp Sales Bot API
  <br />
</h1>

<p align="center">
  Backend multi-tenant para automação de vendas no WhatsApp.<br />
  Construído com Fastify, Prisma, Redis e BullMQ.
</p>

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white&style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white&style=flat-square" />
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white&style=flat-square" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white&style=flat-square" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white&style=flat-square" />
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white&style=flat-square" />
  <img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-Queue-EA4AAA?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/License-ISC-yellow?style=flat-square" />
</p>

<p align="center">
  <a href="#-visão-geral">Visão Geral</a> ·
  <a href="#-stack">Stack</a> ·
  <a href="#-arquitetura">Arquitetura</a> ·
  <a href="#-pré-requisitos">Pré-requisitos</a> ·
  <a href="#-como-rodar">Como Rodar</a> ·
  <a href="#-uso-da-api">Uso da API</a> ·
  <a href="#-endpoints">Endpoints</a> ·
  <a href="#-scripts">Scripts</a> ·
  <a href="#-testes-e-ci">Testes e CI</a> ·
  <a href="#-docker">Docker</a>
</p>

---

## 📋 Visão Geral

Sistema SaaS multi-tenant para operação de bots comerciais no WhatsApp. Cada negócio cadastrado possui seu próprio número conectado, fluxos de atendimento personalizados e mensagens 100% configuráveis via painel administrativo.

**Principais funcionalidades:**

- 🔐 Autenticação JWT com refresh token rotativo e cookie HttpOnly
- 🏢 Arquitetura SaaS multi-tenant com isolamento total de dados por tenant
- 📱 Integração WhatsApp via Baileys com suporte a múltiplas sessões
- 💾 Sessões WhatsApp persistidas no Redis (sem dependência de pasta local)
- 🔄 Engine de fluxos e passos configuráveis sem código
- 💬 Persistência de conversas e mensagens por contato
- 🪝 Webhooks com API key, assinatura HMAC-SHA256 e retries automáticos via BullMQ
- 📄 Documentação OpenAPI interativa via Swagger UI

---

## 🛠 Stack

| Camada          | Tecnologia          | Versão         |
| --------------- | ------------------- | -------------- |
| Runtime         | Node.js             | 22+            |
| Linguagem       | TypeScript (strict) | 5.x            |
| Framework HTTP  | Fastify             | 5.x            |
| ORM             | Prisma              | 7.x            |
| Banco de dados  | PostgreSQL          | 17             |
| Cache / Sessões | Redis               | 7              |
| Fila de tarefas | BullMQ              | latest         |
| Validação       | Zod                 | latest         |
| Logger          | Pino                | nativo Fastify |
| Testes          | Vitest              | latest         |

---

## 🏗 Arquitetura

O projeto segue uma arquitetura modular orientada a domínio. Cada módulo encapsula seu próprio controller, service, routes e schema.

```
.
├── src/
│   ├── app.ts                    # Setup do Fastify + plugins
│   ├── server.ts                 # Entry point
│   ├── config/
│   │   └── env.ts                # Variáveis de ambiente validadas com Zod
│   ├── modules/
│   │   ├── auth/                 # Login, refresh token, logout
│   │   ├── tenants/              # CRUD de negócios (SUPER_ADMIN)
│   │   ├── users/                # Usuários do painel administrativo
│   │   ├── whatsapp/             # Conexão WA, sessões, QR code, envio
│   │   ├── flows/                # Fluxos de conversa e steps
│   │   ├── messages/             # Templates de mensagem com variáveis
│   │   ├── contacts/             # Contatos e histórico de conversas
│   │   └── webhooks/             # Webhooks, API keys, eventos externos
│   └── shared/
│       ├── plugins/              # Prisma, Redis, Swagger registrados como plugins
│       ├── middlewares/          # authenticate, resolveTenant, requireRole
│       ├── queue/                # Setup BullMQ (Queue + Worker + Events)
│       └── utils/                # Helpers gerais
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker-compose.yml
└── README.md
```

### Fluxo de mensagem recebida

```
WhatsApp (Baileys)
      │
      ▼ evento onMessage
BullMQ (fila: message-received)
      │
      ▼ Worker consome job
Bot Engine ─── busca tenant + fluxo ativo (PostgreSQL)
      │       └─ lê estado da conversa (Redis)
      ▼
Resolve step ── interpola variáveis no MessageTemplate
      │
      ▼
Baileys envia resposta ──► Usuário WhatsApp
      │
      ├─► Persiste ConversationMessage (PostgreSQL)
      └─► Dispara Webhook externo (se configurado)
```

---

## ✅ Pré-requisitos

- [Node.js 22+](https://nodejs.org/)
- [Docker](https://www.docker.com/) e Docker Compose
- [npm](https://www.npmjs.com/)

---

## 🚀 Como Rodar

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/seu-usuario/whatsapp-sales-bot.git
cd whatsapp-sales-bot
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
# Aplicação
NODE_ENV=development
PORT=3000
SERVER_URL=http://localhost:3000

# Banco de dados
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salesbot

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Cookies
COOKIE_SECRET=seu_cookie_secret_aqui
```

### 3. Subir infraestrutura (PostgreSQL + Redis)

```bash
docker compose up -d bot redis
```

### 4. Aplicar migrations e seed

```bash
npx prisma migrate dev
npx prisma db seed
```

### 5. Iniciar o servidor

```bash
npm run dev
```

### 6. Verificar

| Serviço      | URL                          |
| ------------ | ---------------------------- |
| Health check | http://localhost:3000/health |
| Swagger UI   | http://localhost:3000/docs   |

---

## 📡 Uso da API

### Autenticação

Todas as rotas protegidas exigem o header:

```
Authorization: Bearer <access_token>
```

O `access_token` expira em **15 minutos**. Use `/auth/refresh` para renová-lo silenciosamente via cookie HttpOnly `refreshToken`.

Integrações externas usam API key no header:

```
x-api-key: wk_ab12cd.xxxxxxxxxxxxxxxxxxxxx
```

---

### Fluxo básico de uso

#### 1 — Autenticar

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@tenant.com", "password": "12345678"}'
```

Guarde o `accessToken` retornado.

#### 2 — Criar tenant _(requer SUPER_ADMIN)_

```bash
curl -X POST http://localhost:3000/tenants \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme LTDA", "slug": "acme", "email": "contato@acme.com", "plan": "PRO"}'
```

#### 3 — Conectar WhatsApp

```bash
# Iniciar conexão e obter QR code
curl -X POST http://localhost:3000/whatsapp/connect \
  -H "Authorization: Bearer <access_token>"

# Verificar status (aguardar CONNECTED após escanear o QR)
curl http://localhost:3000/whatsapp/status \
  -H "Authorization: Bearer <access_token>"
```

#### 4 — Criar template de mensagem

```bash
curl -X POST http://localhost:3000/message-templates \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Boas Vindas",
    "content": "Olá {{nome}}, bem-vindo(a) à {{empresa}}! Como posso ajudar?",
    "type": "TEXT"
  }'
```

#### 5 — Criar e ativar fluxo

```bash
# Criar fluxo
curl -X POST http://localhost:3000/flows \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Boas-vindas", "triggerType": "FIRST_MESSAGE"}'

# Adicionar step ao fluxo
curl -X POST http://localhost:3000/flows/<flowId>/steps \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"order": 1, "type": "SEND_MESSAGE", "templateId": "<templateId>"}'

# Ativar fluxo
curl -X POST http://localhost:3000/flows/<flowId>/activate \
  -H "Authorization: Bearer <access_token>"
```

#### 6 — Configurar webhook _(opcional)_

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CRM Integration",
    "url": "https://api.exemplo.com/hooks/whatsapp",
    "events": ["MESSAGE_RECEIVED", "FLOW_COMPLETED"]
  }'
```

---

## 📚 Endpoints

### System

| Método | Rota      | Auth | Descrição                 |
| ------ | --------- | ---- | ------------------------- |
| `GET`  | `/health` | —    | Health check da aplicação |

### Auth

| Método | Rota            | Auth   | Descrição            |
| ------ | --------------- | ------ | -------------------- |
| `POST` | `/auth/login`   | —      | Autenticar usuário   |
| `POST` | `/auth/refresh` | Cookie | Renovar access token |
| `POST` | `/auth/logout`  | Cookie | Encerrar sessão      |

### Tenants _(SUPER_ADMIN)_

| Método   | Rota           | Auth   | Descrição        |
| -------- | -------------- | ------ | ---------------- |
| `POST`   | `/tenants`     | Bearer | Criar tenant     |
| `GET`    | `/tenants`     | Bearer | Listar tenants   |
| `GET`    | `/tenants/:id` | Bearer | Detalhar tenant  |
| `PATCH`  | `/tenants/:id` | Bearer | Atualizar tenant |
| `DELETE` | `/tenants/:id` | Bearer | Remover tenant   |

### Users

| Método  | Rota                 | Auth   | Descrição        |
| ------- | -------------------- | ------ | ---------------- |
| `POST`  | `/users`             | Bearer | Criar usuário    |
| `GET`   | `/users/me`          | Bearer | Meu perfil       |
| `PATCH` | `/users/me`          | Bearer | Atualizar perfil |
| `PATCH` | `/users/me/password` | Bearer | Alterar senha    |

### WhatsApp

| Método | Rota                   | Auth   | Descrição                  |
| ------ | ---------------------- | ------ | -------------------------- |
| `POST` | `/whatsapp/connect`    | Bearer | Iniciar conexão e gerar QR |
| `GET`  | `/whatsapp/status`     | Bearer | Status da sessão           |
| `POST` | `/whatsapp/disconnect` | Bearer | Desconectar sessão         |
| `POST` | `/whatsapp/send`       | Bearer | Enviar mensagem manual     |

### Flows

| Método   | Rota                           | Auth   | Descrição       |
| -------- | ------------------------------ | ------ | --------------- |
| `POST`   | `/flows`                       | Bearer | Criar fluxo     |
| `GET`    | `/flows`                       | Bearer | Listar fluxos   |
| `GET`    | `/flows/:id`                   | Bearer | Detalhar fluxo  |
| `PATCH`  | `/flows/:id`                   | Bearer | Atualizar fluxo |
| `DELETE` | `/flows/:id`                   | Bearer | Remover fluxo   |
| `POST`   | `/flows/:id/activate`          | Bearer | Ativar fluxo    |
| `POST`   | `/flows/:flowId/steps`         | Bearer | Criar step      |
| `GET`    | `/flows/:flowId/steps`         | Bearer | Listar steps    |
| `PATCH`  | `/flows/:flowId/steps/:stepId` | Bearer | Atualizar step  |
| `DELETE` | `/flows/:flowId/steps/:stepId` | Bearer | Remover step    |

### Message Templates

| Método   | Rota                     | Auth   | Descrição          |
| -------- | ------------------------ | ------ | ------------------ |
| `POST`   | `/message-templates`     | Bearer | Criar template     |
| `GET`    | `/message-templates`     | Bearer | Listar templates   |
| `GET`    | `/message-templates/:id` | Bearer | Detalhar template  |
| `PATCH`  | `/message-templates/:id` | Bearer | Atualizar template |
| `DELETE` | `/message-templates/:id` | Bearer | Remover template   |

### Contacts

| Método   | Rota                    | Auth   | Descrição              |
| -------- | ----------------------- | ------ | ---------------------- |
| `GET`    | `/contacts`             | Bearer | Listar contatos        |
| `GET`    | `/contacts/:id`         | Bearer | Detalhar contato       |
| `GET`    | `/contacts/:id/history` | Bearer | Histórico de conversas |
| `DELETE` | `/contacts/:id`         | Bearer | Remover contato        |

### Webhooks

| Método   | Rota                       | Auth    | Descrição              |
| -------- | -------------------------- | ------- | ---------------------- |
| `POST`   | `/webhooks`                | Bearer  | Criar webhook          |
| `GET`    | `/webhooks`                | Bearer  | Listar webhooks        |
| `GET`    | `/webhooks/:id`            | Bearer  | Detalhar webhook       |
| `PATCH`  | `/webhooks/:id`            | Bearer  | Atualizar webhook      |
| `DELETE` | `/webhooks/:id`            | Bearer  | Remover webhook        |
| `POST`   | `/webhooks/:id/test`       | Bearer  | Testar entrega         |
| `POST`   | `/webhooks/api-keys`       | Bearer  | Criar API key          |
| `GET`    | `/webhooks/api-keys`       | Bearer  | Listar API keys        |
| `POST`   | `/webhooks/events/inbound` | API Key | Receber evento externo |

### Queues

| Método | Rota                   | Auth | Descrição                    |
| ------ | ---------------------- | ---- | ---------------------------- |
| `POST` | `/queues/sales/test`   | —    | Enfileirar mensagem de teste |
| `GET`  | `/queues/sales/:jobId` | —    | Consultar status do job      |

---

## ⚙️ Scripts

```bash
# Desenvolvimento
npm run dev          # Inicia com hot-reload (tsx watch)

# Build
npm run build        # Compila TypeScript com tsup
npm run start        # Inicia build de produção

# Testes
npm test             # Executa todos os testes (Vitest)
npm run test:watch   # Modo watch
npm run test:cov     # Com cobertura de código

# Qualidade
npm run lint         # ESLint
npm run lint:fix     # ESLint com correção automática
npm run format       # Prettier
npm run format:check # Verifica formatação sem alterar

# Prisma
npm run db:migrate   # Aplica migrations
npm run db:seed      # Executa seed
npm run db:studio    # Abre Prisma Studio
```

---

## 🧪 Testes e CI

### Estratégia de testes

| Camada          | Foco                                                        | Prioridade      |
| --------------- | ----------------------------------------------------------- | --------------- |
| **Unit**        | Bot engine, isolamento de tenant, lógica de auth, templates | 🔴 Alta         |
| **Integration** | Rotas de auth, CRUD de fluxos, middlewares, rate limiting   | 🟡 Média        |
| **E2E**         | Onboarding completo de tenant, simulação de conversa        | 🟢 Nice to have |

Testes de isolamento multi-tenant são **obrigatórios** — um vazamento de dados entre tenants é crítico.

### Pipeline CI (GitHub Actions)

O pipeline executa em todo PR e push para `main`:

```
lint → format:check → test → build
```

---

## 🐳 Docker

### Apenas infraestrutura (recomendado para desenvolvimento)

```bash
# Subir PostgreSQL + Redis
docker compose up -d bot redis

# Derrubar
docker compose down
```

### Stack completa (app + banco + redis)

```bash
# Subir tudo
docker compose up -d

# Ver logs
docker compose logs -f api

# Derrubar e limpar volumes
docker compose down -v
```

---

## 🔐 Segurança

| Mecanismo        | Implementação                                             |
| ---------------- | --------------------------------------------------------- |
| Senhas           | bcryptjs com cost factor 12                               |
| Access Token     | JWT com expiração de 15 minutos                           |
| Refresh Token    | Rotativo, hash SHA-256 no banco, cookie HttpOnly          |
| API Keys         | Prefixadas, hash SHA-256 armazenado                       |
| Tenant isolation | `tenantId` obrigatório em todas as queries via middleware |
| Rate limiting    | Por IP e por tenant (`@fastify/rate-limit`)               |
| Headers HTTP     | Helmet com políticas restritivas                          |
| Validação        | Zod em todos os inputs de rota e variáveis de ambiente    |
| Webhooks         | Assinatura HMAC-SHA256 no payload                         |

---

## 📄 Licença

Distribuído sob a licença **ISC**. Veja `LICENSE` para mais detalhes.
