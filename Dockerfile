FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# Install all deps for build, then prune to production-only deps.
RUN npm ci

COPY tsconfig.json eslint.config.js prisma.config.ts ./
COPY src ./src

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev --omit=optional && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/server.js"]
