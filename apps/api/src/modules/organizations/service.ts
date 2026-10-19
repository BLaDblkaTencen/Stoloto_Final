// Модуль organizations: работа с базой. Владелец: участник 2.
// Поля решения админа (status, rejection_reason, reviewed_*) меняет только модуль admin,
// здесь — лишь повторная подача заявки владельцем.
import type {
  CreateOrganizationBody,
  OrganizationListQuery,
  OrganizationOwner,
  OrganizationPublic,
  OrganizationView,
  SportRef,
  UpdateOrganizationBody,
} from '@sport/shared/schemas/organizations';
import { and, asc, count, eq, exists, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Db, type Tx } from '../../db/client';
import { organizationSports, organizations, sports } from '../../db/schema';
import { AppError, errors } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import {
  checkPublishing,
  notRejected,
  orgNameKey,
  orgNotFound,
  resubmitChanges,
  selectView,
  toOwner,
  toPublic,
  type OrganizationRow,
  type Viewer,
} from './rules';

type Executor = Db | Tx;

const nameTaken = () =>
  new AppError(409, 'ORG_NAME_TAKEN', 'Организация с таким названием уже есть на платформе', {
    name: 'Такое название уже занято',
  });
const alreadyExists = () =>
  new AppError(409, 'ORG_ALREADY_EXISTS', 'У вашего аккаунта уже есть организация');

// ---------- Для других модулей ----------

/**
 * Задача 2.6. Вызывается из POST /api/events (участник 1) для аккаунта organization.
 * Бросает 403 ORG_NOT_APPROVED, если организации нет или она не допущена.
 */
export async function assertCanPublishAsOrganization(
  user: SessionUser,
): Promise<{ organizationId: string; name: string }> {
  if (user.role !== 'organization') {
    throw errors.forbidden('Публиковать от имени организации может только аккаунт организации');
  }
  return checkPublishing(await findByOwner(user.id));
}

// ---------- Кабинет организации ----------

export async function createOrganization(
  user: SessionUser,
  body: CreateOrganizationBody,
): Promise<OrganizationOwner> {
  try {
    return await db.transaction(async (tx) => {
      if (await findByOwner(user.id, tx)) throw alreadyExists();
      await assertNameFree(body.name, null, tx);
      await assertSportsExist(body.sportIds, tx);

      const [org] = await tx
        .insert(organizations)
        .values({
          ownerId: user.id,
          name: body.name,
          description: body.description,
          activity: body.activity,
          city: body.city ?? null,
          contacts: body.contacts ?? null,
        })
        .returning();
      await replaceSports(org!.id, body.sportIds, tx);
      return toOwner(org!, await sportsOf(org!.id, tx));
    });
  } catch (err) {
    // Два одновременных запроса: второй упрётся в уникальность владельца.
    if (uniqueViolation(err) === 'organizations_owner_uq') throw alreadyExists();
    throw err;
  }
}

export async function getMyOrganization(user: SessionUser): Promise<OrganizationOwner> {
  const org = await findByOwner(user.id);
  if (!org) throw orgNotFound();
  return toOwner(org, await sportsOf(org.id));
}

export async function updateMyOrganization(
  user: SessionUser,
  body: UpdateOrganizationBody,
): Promise<OrganizationOwner> {
  return db.transaction(async (tx) => {
    const org = await findByOwner(user.id, tx);
    if (!org) throw orgNotFound();
    if (body.name !== undefined && orgNameKey(body.name) !== orgNameKey(org.name)) {
      await assertNameFree(body.name, org.id, tx);
    }
    if (body.sportIds) await assertSportsExist(body.sportIds, tx);

    const { sportIds, ...fields } = body;
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    let updated: OrganizationRow = org;
    if (Object.keys(changes).length > 0) {
      [updated] = (await tx
        .update(organizations)
        .set(changes)
        .where(eq(organizations.id, org.id))
        .returning()) as [OrganizationRow];
    }
    if (sportIds) await replaceSports(org.id, sportIds, tx);
    return toOwner(updated, await sportsOf(org.id, tx));
  });
}

export async function resubmitMyOrganization(user: SessionUser): Promise<OrganizationOwner> {
  const org = await findByOwner(user.id);
  if (!org) throw orgNotFound();
  const [updated] = await db
    .update(organizations)
    .set(resubmitChanges(org))
    // Условие на статус защищает от гонки с решением админа.
    .where(and(eq(organizations.id, org.id), eq(organizations.status, 'rejected')))
    .returning();
  if (!updated) throw notRejected();
  return toOwner(updated, await sportsOf(org.id));
}

// ---------- Публичная часть ----------

export async function listOrganizations(
  query: OrganizationListQuery,
): Promise<{ items: OrganizationPublic[]; total: number }> {
  const filters: SQL[] = [eq(organizations.status, 'approved')];
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    filters.push(
      or(ilike(organizations.name, pattern), ilike(organizations.description, pattern))!,
    );
  }
  if (query.city) filters.push(ilike(organizations.city, `%${escapeLike(query.city)}%`));
  if (query.sportId) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(organizationSports)
          .where(
            and(
              eq(organizationSports.organizationId, organizations.id),
              eq(organizationSports.sportId, query.sportId),
            ),
          ),
      ),
    );
  }
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(organizations)
      .where(where)
      .orderBy(asc(organizations.name))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(organizations).where(where),
  ]);
  const sportsMap = await sportsByOrg(rows.map((row) => row.id));
  return {
    items: rows.map((row) => toPublic(row, sportsMap.get(row.id) ?? [])),
    total: totalRow?.total ?? 0,
  };
}

export async function getOrganization(id: string, viewer: Viewer): Promise<OrganizationView> {
  // Неверный UUID — та же 404, а не ошибка базы.
  if (!z.uuid().safeParse(id).success) throw orgNotFound();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) throw orgNotFound();

  const view = selectView(org, viewer);
  const orgSports = await sportsOf(org.id);
  return view === 'owner'
    ? { view, ...toOwner(org, orgSports) }
    : { view, ...toPublic(org, orgSports) };
}

// ---------- Внутреннее ----------

async function findByOwner(ownerId: string, ex: Executor = db): Promise<OrganizationRow | null> {
  const [org] = await ex
    .select()
    .from(organizations)
    .where(eq(organizations.ownerId, ownerId))
    .limit(1);
  return org ?? null;
}

/**
 * Название должно быть свободно среди допущенных: иначе админ не сможет одобрить заявку
 * (уникальный индекс), поэтому предупреждаем сразу при подаче и при смене названия.
 */
async function assertNameFree(name: string, exceptId: string | null, ex: Executor) {
  const conditions = [
    eq(organizations.status, 'approved'),
    sql`lower(${organizations.name}) = ${orgNameKey(name)}`,
  ];
  if (exceptId) conditions.push(ne(organizations.id, exceptId));
  const [clash] = await ex
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(...conditions))
    .limit(1);
  if (clash) throw nameTaken();
}

async function assertSportsExist(ids: string[], ex: Executor) {
  const found = await ex.select({ id: sports.id }).from(sports).where(inArray(sports.id, ids));
  if (found.length !== ids.length) {
    throw errors.validation({ sportIds: 'Некоторые виды спорта не найдены' });
  }
}

async function replaceSports(organizationId: string, sportIds: string[], ex: Executor) {
  await ex.delete(organizationSports).where(eq(organizationSports.organizationId, organizationId));
  await ex
    .insert(organizationSports)
    .values(sportIds.map((sportId) => ({ organizationId, sportId })));
}

async function sportsOf(organizationId: string, ex: Executor = db): Promise<SportRef[]> {
  return (await sportsByOrg([organizationId], ex)).get(organizationId) ?? [];
}

/** Виды спорта сразу для многих организаций: один запрос вместо запроса на каждую. */
async function sportsByOrg(ids: string[], ex: Executor = db): Promise<Map<string, SportRef[]>> {
  const result = new Map<string, SportRef[]>();
  if (ids.length === 0) return result;
  const rows = await ex
    .select({
      organizationId: organizationSports.organizationId,
      id: sports.id,
      name: sports.name,
      slug: sports.slug,
    })
    .from(organizationSports)
    .innerJoin(sports, eq(sports.id, organizationSports.sportId))
    .where(inArray(organizationSports.organizationId, ids))
    .orderBy(asc(sports.name));
  for (const { organizationId, ...sport } of rows) {
    const list = result.get(organizationId) ?? [];
    list.push(sport);
    result.set(organizationId, list);
  }
  return result;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/** Имя нарушенного уникального ограничения, если ошибка — нарушение уникальности (23505). */
function uniqueViolation(err: unknown): string | null {
  let current: unknown = err;
  // Drizzle оборачивает ошибку драйвера в cause.
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (record.code === '23505') {
      return typeof record.constraint_name === 'string' ? record.constraint_name : '';
    }
    current = record.cause;
  }
  return null;
}
