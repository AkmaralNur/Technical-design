import { Prisma } from '@prisma/client';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';

/** Запись события в журнал audit_log (раздел 15.5) */
export async function log(
  tx: Tx | typeof db,
  userId: number | bigint | null,
  action: string,
  entity: string,
  entityId: number | bigint | null,
  details?: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: {
      userId: userId === null ? null : BigInt(userId),
      action,
      entity,
      entityId: entityId === null ? null : BigInt(entityId),
      details: details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined,
    },
  });
}
