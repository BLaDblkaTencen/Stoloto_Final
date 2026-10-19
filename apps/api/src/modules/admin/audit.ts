// Журнал решений администратора. Владелец: участник 3.
// Запись идёт в той же транзакции, что и само решение: решение без записи в журнале невозможно.
import type { AuditAction, AuditTarget } from '@sport/shared';
import type { AuditEntry } from '@sport/shared/schemas/admin';
import { and, desc, eq } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { auditLog, users } from '../../db/schema';

export async function writeAudit(
  tx: Tx,
  entry: {
    actorId: string;
    action: AuditAction;
    targetType: AuditTarget;
    targetId: string;
    reason?: string;
  },
) {
  await tx.insert(auditLog).values({ ...entry, reason: entry.reason ?? null });
}

/** История решений по объекту, новые сверху. */
export async function historyOf(targetType: AuditTarget, targetId: string): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      action: auditLog.action,
      reason: auditLog.reason,
      createdAt: auditLog.createdAt,
      actorId: users.id,
      actorName: users.name,
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.targetType, targetType), eq(auditLog.targetId, targetId)))
    .orderBy(desc(auditLog.createdAt));
  return rows.map((row) => ({
    action: row.action,
    reason: row.reason,
    actor: { id: row.actorId, name: row.actorName },
    createdAt: row.createdAt.toISOString(),
  }));
}
