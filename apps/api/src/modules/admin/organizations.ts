// Допуск организаций (задача 3.4). Владелец: участник 3.
// Поля решения (status, rejection_reason, reviewed_by, reviewed_at) меняет только этот модуль —
// DATA_MODEL.md, «Кто меняет данные».
import type {
  AdminList,
  AdminOrganizationDetails,
  AdminOrganizationItem,
  adminOrganizationsQuery,
} from '@sport/shared/schemas/admin';
import { and, asc, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '../../db/client';
import { events, organizations, organizationSports, sports, users } from '../../db/schema';
import { uniqueViolation } from '../../lib/db-errors';
import { AppError } from '../../lib/errors';
import { historyOf, writeAudit } from './audit';
import { containsPattern } from './search';

const notFound = () => new AppError(404, 'ORG_NOT_FOUND', 'Организация не найдена');
const notPending = () =>
  new AppError(409, 'ORG_NOT_PENDING', 'Заявка уже рассмотрена: обновите страницу');
const nameTaken = () =>
  new AppError(
    409,
    'ORG_NAME_TAKEN',
    'Организация с таким названием уже допущена. Отклоните заявку и попросите сменить название',
  );

const itemColumns = {
  id: organizations.id,
  name: organizations.name,
  activity: organizations.activity,
  city: organizations.city,
  status: organizations.status,
  createdAt: organizations.createdAt,
  reviewedAt: organizations.reviewedAt,
  ownerId: users.id,
  ownerName: users.name,
  ownerEmail: users.email,
  eventsCount: sql<number>`(select count(*)::int from ${events} where ${events.organizationId} = ${organizations.id})`,
};

type ItemRow = {
  id: string;
  name: string;
  activity: string;
  city: string | null;
  status: AdminOrganizationItem['status'];
  createdAt: Date;
  reviewedAt: Date | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  eventsCount: number;
};

const toItem = (row: ItemRow): AdminOrganizationItem => ({
  id: row.id,
  name: row.name,
  activity: row.activity,
  city: row.city,
  status: row.status,
  owner: { id: row.ownerId, name: row.ownerName, email: row.ownerEmail },
  createdAt: row.createdAt.toISOString(),
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  eventsCount: row.eventsCount,
});

/** Заявки на рассмотрении — первыми, дальше новые сверху. */
export async function listOrganizations(
  query: z.output<typeof adminOrganizationsQuery>,
): Promise<AdminList<AdminOrganizationItem>> {
  const pattern = query.q ? containsPattern(query.q) : undefined;
  const where = and(
    query.status ? eq(organizations.status, query.status) : undefined,
    pattern
      ? or(
          ilike(organizations.name, pattern),
          ilike(users.email, pattern),
          ilike(users.name, pattern),
        )
      : undefined,
  );
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(itemColumns)
      .from(organizations)
      .innerJoin(users, eq(users.id, organizations.ownerId))
      .where(where)
      .orderBy(
        sql`case when ${organizations.status} = 'pending' then 0 else 1 end`,
        desc(organizations.createdAt),
      )
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(organizations)
      .innerJoin(users, eq(users.id, organizations.ownerId))
      .where(where),
  ]);
  return { items: rows.map(toItem), total: totalRow?.total ?? 0 };
}

export async function getOrganization(id: string): Promise<AdminOrganizationDetails> {
  const [row] = await db
    .select({
      ...itemColumns,
      description: organizations.description,
      contacts: organizations.contacts,
      rejectionReason: organizations.rejectionReason,
    })
    .from(organizations)
    .innerJoin(users, eq(users.id, organizations.ownerId))
    .where(eq(organizations.id, id));
  if (!row) throw notFound();

  const [orgSports, orgEvents, history] = await Promise.all([
    db
      .select({ id: sports.id, name: sports.name })
      .from(organizationSports)
      .innerJoin(sports, eq(sports.id, organizationSports.sportId))
      .where(eq(organizationSports.organizationId, id))
      .orderBy(asc(sports.name)),
    db
      .select({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
        status: events.status,
      })
      .from(events)
      .where(eq(events.organizationId, id))
      .orderBy(desc(events.startsAt)),
    historyOf('organization', id),
  ]);

  return {
    ...toItem(row),
    description: row.description,
    contacts: row.contacts,
    rejectionReason: row.rejectionReason,
    sports: orgSports,
    events: orgEvents.map((e) => ({ ...e, startsAt: e.startsAt.toISOString() })),
    history,
  };
}

export async function approveOrganization(adminId: string, id: string) {
  await db.transaction(async (tx) => {
    // Блокировка строки: два администратора не рассмотрят одну заявку одновременно.
    const [org] = await tx
      .select({ status: organizations.status, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, id))
      .for('update');
    if (!org) throw notFound();
    if (org.status !== 'pending') throw notPending();

    // Название уникально среди допущенных (organizations_approved_name_uq).
    const [twin] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.status, 'approved'),
          ne(organizations.id, id),
          eq(sql`lower(${organizations.name})`, org.name.toLowerCase()),
        ),
      );
    if (twin) throw nameTaken();

    await tx
      .update(organizations)
      .set({
        status: 'approved',
        rejectionReason: null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .catch((err: unknown) => {
        // На случай гонки: другую организацию с тем же названием допустили между проверкой и записью.
        throw uniqueViolation(err) === 'organizations_approved_name_uq' ? nameTaken() : err;
      });
    await writeAudit(tx, {
      actorId: adminId,
      action: 'org.approve',
      targetType: 'organization',
      targetId: id,
    });
  });
  return getOrganization(id);
}

export async function rejectOrganization(adminId: string, id: string, reason: string) {
  await db.transaction(async (tx) => {
    const [org] = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, id))
      .for('update');
    if (!org) throw notFound();
    if (org.status !== 'pending') throw notPending();

    await tx
      .update(organizations)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      })
      .where(eq(organizations.id, id));
    await writeAudit(tx, {
      actorId: adminId,
      action: 'org.reject',
      targetType: 'organization',
      targetId: id,
      reason,
    });
  });
  return getOrganization(id);
}
