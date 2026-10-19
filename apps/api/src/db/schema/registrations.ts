// Записи на мероприятия. Владелец: участник 1 (registrations).
// Решение по заявке (pending -> confirmed/rejected) принимает панель организатора (участник 2)
// через сервис этого модуля, а не своим SQL: правила переходов живут в одном месте.
import { relations, sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt, registrationStatus, tz, updatedAt } from './common';
import { events } from './events';
import { users } from './users';

export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: registrationStatus('status').notNull(),
    message: text('message'),
    decidedAt: tz('decided_at'),
    decidedBy: uuid('decided_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Одна запись на пару: отмена и повторная запись меняют статус, а не плодят строки.
    unique('registrations_event_user_uq').on(t.eventId, t.userId),
    // Заявку может решить только автор события; админ — нет (требование ТЗ).
    foreignKey({
      name: 'registrations_decider_fk',
      columns: [t.eventId, t.decidedBy],
      foreignColumns: [events.id, events.createdBy],
    }),
    index('registrations_user_idx').on(t.userId),
    index('registrations_event_status_idx').on(t.eventId, t.status),
    check(
      'registrations_rejected_decided_chk',
      sql`${t.status} <> 'rejected' or (${t.decidedBy} is not null and ${t.decidedAt} is not null)`,
    ),
    check(
      'registrations_message_len_chk',
      sql`${t.message} is null or char_length(${t.message}) <= 500`,
    ),
  ],
);

export const registrationsRelations = relations(registrations, ({ one }) => ({
  event: one(events, { fields: [registrations.eventId], references: [events.id] }),
  user: one(users, {
    fields: [registrations.userId],
    references: [users.id],
    relationName: 'registration_user',
  }),
  decider: one(users, {
    fields: [registrations.decidedBy],
    references: [users.id],
    relationName: 'registration_decider',
  }),
}));
