import { Prisma, PrismaClient } from '@prisma/client';

// BIGINT из PostgreSQL приходит как bigint — в JSON отдаём обычным числом.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/** Один объект подключения на весь сервер (Prisma держит пул соединений). */
export const db = new PrismaClient();

/** Клиент внутри транзакции */
export type Tx = Prisma.TransactionClient;
