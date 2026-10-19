// Организации и их спортивные интересы. Владелец: участник 2 (organizations).
// Поля решения (status, rejection_reason, reviewed_by, reviewed_at) меняет только модуль admin,
// кроме повторной подачи заявки: её делает владелец организации (status -> pending, причина очищается).
import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, orgStatus, tz, updatedAt } from './common';
import { events } from './events';
import { sports } from './sports';
import { users } from './users';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    activity: text('activity').notNull(),
    city: text('city'),
    contacts: text('contacts'),
    status: orgStatus('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: tz('reviewed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // У аккаунта-представителя ровно одна организация.
    uniqueIndex('organizations_owner_uq').on(t.ownerId),
    // Нужен для составного внешнего ключа events (organization_id, created_by).
    unique('organizations_id_owner_uq').on(t.id, t.ownerId),
    // Название уникально только среди допущенных: заявки с одинаковым именем могут ждать решения.
    uniqueIndex('organizations_approved_name_uq')
      .on(sql`lower(${t.name})`)
      .where(sql`${t.status} = 'approved'`),
    index('organizations_status_idx').on(t.status),
    check('organizations_name_len_chk', sql`char_length(btrim(${t.name})) between 2 and 100`),
    check(
      'organizations_rejection_reason_chk',
      sql`${t.status} <> 'rejected' or char_length(btrim(coalesce(${t.rejectionReason}, ''))) > 0`,
    ),
    check(
      'organizations_reviewed_chk',
      sql`${t.status} = 'pending' or (${t.reviewedBy} is not null and ${t.reviewedAt} is not null)`,
    ),
  ],
);

export const organizationSports = pgTable(
  'organization_sports',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    sportId: uuid('sport_id')
      .notNull()
      .references(() => sports.id),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.sportId] })],
);

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
    relationName: 'organization_owner',
  }),
  reviewer: one(users, {
    fields: [organizations.reviewedBy],
    references: [users.id],
    relationName: 'organization_reviewer',
  }),
  sports: many(organizationSports),
  events: many(events),
}));

export const organizationSportsRelations = relations(organizationSports, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSports.organizationId],
    references: [organizations.id],
  }),
  sport: one(sports, { fields: [organizationSports.sportId], references: [sports.id] }),
}));
