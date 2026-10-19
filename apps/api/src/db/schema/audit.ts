// Журнал решений администратора и служебные данные. Владелец: участник 3 (admin, seed).
import { relations, sql } from 'drizzle-orm';
import { check, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { auditAction, auditTarget, createdAt, updatedAt } from './common';
import { users } from './users';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    action: auditAction('action').notNull(),
    targetType: auditTarget('target_type').notNull(),
    // Без внешнего ключа: цель бывает трёх типов. Сами записи не удаляются (мягкое удаление).
    targetId: uuid('target_id').notNull(),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_target_idx').on(t.targetType, t.targetId),
    index('audit_log_created_idx').on(t.createdAt),
    check(
      'audit_log_target_matches_action_chk',
      sql`(${t.action} in ('org.approve', 'org.reject') and ${t.targetType} = 'organization')
        or (${t.action} in ('event.unpublish', 'event.delete') and ${t.targetType} = 'event')
        or (${t.action} = 'comment.hide' and ${t.targetType} = 'comment')`,
    ),
    check(
      'audit_log_reason_chk',
      sql`${t.action} not in ('org.reject', 'event.unpublish', 'event.delete')
        or char_length(btrim(coalesce(${t.reason}, ''))) > 0`,
    ),
  ],
);

// Служебные пары ключ-значение. Сейчас одна: seed_version.
// Сид при старте сервера наполняет базу, только если версия в коде новее записанной.
// Иначе бесплатный Render, просыпаясь, перезапускал бы сид и стирал данные экспертов.
export const appMeta = pgTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: updatedAt(),
});

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));
