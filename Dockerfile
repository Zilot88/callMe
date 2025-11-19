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

# Устанавливаем необходимые системные зависимости
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=4057
ENV HOSTNAME=0.0.0.0

# Копируем необходимые файлы из builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./
COPY --from=builder /app/next.config.ts ./

# Создаем папку для SSL сертификатов
RUN mkdir -p /app/ssl

# Копируем SSL сертификаты (если они уже есть)
COPY --from=builder /app/ssl ./ssl

# Открываем порт 4057
EXPOSE 4057

# Запускаем приложение
CMD ["node", "server.js"]
