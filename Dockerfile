# syntax=docker/dockerfile:1
# Núcleo: imagen de la app (Next standalone) y una imagen de herramientas para migrar, sembrar y
# correr el cron local. `docker compose --profile completo up --build` levanta todo.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Migraciones, seed y cron: necesitan el código fuente y tsx.
FROM deps AS herramientas
COPY . .
CMD ["pnpm", "db:migrate"]

FROM deps AS build
COPY . .
# Valores solo para compilar: la build no se conecta a nada. Los reales llegan al arrancar.
ENV NEXT_OUTPUT=standalone APP_ENV=production APP_URL=http://localhost:3030 BETTER_AUTH_SECRET=solo-para-compilar-no-se-usa-en-runtime \
    DATABASE_URL=postgres://compilar:compilar@localhost:5432/compilar
RUN pnpm build

FROM node:24-alpine AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3030 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S nucleo && adduser -S nucleo -G nucleo
COPY --from=build --chown=nucleo:nucleo /app/.next/standalone ./
COPY --from=build --chown=nucleo:nucleo /app/.next/static ./.next/static
COPY --from=build --chown=nucleo:nucleo /app/public ./public
USER nucleo
EXPOSE 3030
CMD ["node", "server.js"]
