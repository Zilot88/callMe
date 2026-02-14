# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем Next.js приложение
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
# PORT берётся из env (default 10000)

# Копируем необходимые файлы из builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./
COPY --from=builder /app/next.config.ts ./

# SSL сертификаты — копируем если есть, не падаем если нет
RUN mkdir -p /app/ssl
COPY --from=builder /app/ssl* ./ssl/

EXPOSE 10000

# Запускаем приложение
CMD ["node", "server.js"]
