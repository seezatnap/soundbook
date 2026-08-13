FROM node:22-bookworm-slim AS deps

WORKDIR /app
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV npm_config_update_notifier=false

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV APP_NAME=soundbook
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs soundbook

COPY --from=builder --chown=soundbook:nodejs /app/dist ./dist
COPY --chown=soundbook:nodejs server.mjs ./server.mjs

USER soundbook
EXPOSE 3000

CMD ["node", "server.mjs"]
