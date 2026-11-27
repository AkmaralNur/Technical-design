# Продакшен-образ TrainTix (раздел 18.6): один контейнер = API + собранный React + отправщик писем

# 1. Собираем React
FROM node:20 AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# 2. Собираем сервер
FROM node:20 AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate && npm run build

# 3. Итоговый образ
FROM node:20-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=server /app/server ./server
COPY --from=client /app/client/dist ./client/dist
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
