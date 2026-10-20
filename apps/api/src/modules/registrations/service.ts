// Запись на мероприятия и решения по заявкам (задача 1.6). Владелец: участник 1.
// Правила переходов статусов живут только здесь: панель организатора (участник 2) вызывает
// listRegistrationsForAuthor и decideRegistration, а не пишет свой SQL. Контракт — docs/api/events.md.
//
// Каждое действие идёт в транзакции с блокировкой строки события (SELECT … FOR UPDATE):
// запись, отмена и решение по одному событию выполняются по очереди, поэтому два человека
// не займут последнее место, а организатор не примет заявку сверх лимита.
import { REGISTRATION_STATUSES, type RegistrationStatus } from '@sport/shared';
import type { ListResponse, MyRegistration } from '@sport/shared/schemas/events';
import type {
  Decision,
  MyRegistrationItem,
  MyRegistrationsQuery,
  OrganizerRegistration,
  OrganizerRegistrations,
} from '@sport/shared/schemas/registrations';
import { and, asc, count, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { db, type Db, type Tx } from '../../db/client';
import { events, registrations, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { selectEvents, toListItem } from '../events/queries';
import { participantSummaries, reviewStates } from '../reviews/service';
import { cancelDenial, canSeeEvent, isPast, joinDenial, type Denial } from '../events/rules';
import { eventHidden, eventNotFound } from '../events/service';

const fail = (denial: Denial) => new AppError(denial.status, denial.code, denial.message);
const notAuthor = () =>
  new AppError(403, 'NOT_EVENT_AUTHOR', 'Заявки рассматривает только организатор события');

/** Событие с блокировкой строки до конца транзакции. */
async function lockEvent(tx: Tx, eventId: string) {
  const [event] = await tx
    .select({
      id: events.id,
      status: events.status,
      startsAt: events.startsAt,
      createdBy: events.createdBy,
      joinMode: events.joinMode,
      capacity: events.capacity,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .for('update');
  if (!event) throw eventNotFound();
  return event;
}

async function countConfirmed(tx: Tx, eventId: string) {
  const [{ value }] = await tx
    .select({ value: count() })
    .from(registrations)
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')));
  return value;
}

const registrationColumns = {
  id: registrations.id,
  status: registrations.status,
  message: registrations.message,
  createdAt: registrations.createdAt,
  decidedAt: registrations.decidedAt,
};

function toMyRegistration(row: {
  status: RegistrationStatus;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}): NonNullable<MyRegistration> {
  return {
    status: row.status,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  };
}

/**
 * Записаться: при свободной записи — сразу участник, по заявке — ожидание решения.
 * После отмены запись возвращается в ту же строку (одна строка на пару «событие — человек»).
 */
export async function joinEvent(
  eventId: string,
  user: SessionUser,
  message: string | null,
): Promise<NonNullable<MyRegistration>> {
  return db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const [existing] = await tx
      .select({ id: registrations.id, status: registrations.status })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, user.id)));
    const myStatus = existing?.status ?? null;
    if (!canSeeEvent(event, user, myStatus)) throw eventHidden();

    const denial = joinDenial(event, user, myStatus, await countConfirmed(tx, eventId), new Date());
    if (denial) throw fail(denial);

    const values = {
      status: event.joinMode === 'free' ? ('confirmed' as const) : ('pending' as const),
      // Сообщение организатору имеет смысл только для заявки.
      message: event.joinMode === 'request' ? message : null,
      decidedAt: null,
      decidedBy: null,
    };
    const [row] = existing
      ? await tx
          .update(registrations)
          .set(values)
          .where(eq(registrations.id, existing.id))
          .returning(registrationColumns)
      : await tx
          .insert(registrations)
          .values({ eventId, userId: user.id, ...values })
          .returning(registrationColumns);
    return toMyRegistration(row);
  });
}

/** Отменить запись или заявку. Со снятого события уйти можно, с прошедшего — нет. */
export async function cancelRegistration(
  eventId: string,
  user: SessionUser,
): Promise<NonNullable<MyRegistration>> {
  return db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const [existing] = await tx
      .select({ id: registrations.id, status: registrations.status })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, user.id)));
    const myStatus = existing?.status ?? null;
    if (!canSeeEvent(event, user, myStatus)) throw eventHidden();

    const denial = cancelDenial(event, myStatus, new Date());
    if (denial || !existing)
      throw fail(
        denial ?? { status: 409, code: 'NOT_REGISTERED', message: 'Вы не записаны на это событие' },
      );

    const [row] = await tx
      .update(registrations)
      .set({ status: 'cancelled' })
      .where(eq(registrations.id, existing.id))
      .returning(registrationColumns);
    return toMyRegistration(row);
  });
}

/** «Мои записи»: события, где у меня есть запись в любом статусе, включая снятые. */
export async function listMyRegistrations(
  query: MyRegistrationsQuery,
  user: SessionUser,
): Promise<ListResponse<MyRegistrationItem>> {
  const now = new Date();
  const upcoming = query.scope === 'upcoming';
  const mine = db
    .select({ eventId: registrations.eventId })
    .from(registrations)
    .where(eq(registrations.userId, user.id));
  const where = and(
    inArray(events.id, mine),
    upcoming ? gt(events.startsAt, now) : lte(events.startsAt, now),
  );
  const [rows, [{ total }]] = await Promise.all([
    selectEvents(user.id)
      .where(where)
      .orderBy(upcoming ? asc(events.startsAt) : desc(events.startsAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ total: count() }).from(events).where(where),
  ]);
  // Оценить можно только прошедшую встречу: для предстоящих в базу за отзывами не ходим.
  const reviews = upcoming ? new Map() : await reviewStates(user.id, rows, now);
  const items: MyRegistrationItem[] = [];
  for (const row of rows) {
    const item = toListItem(row);
    if (!item.myRegistration) continue; // запись есть по условию выборки; проверка — для типов
    items.push({
      ...item,
      myRegistration: item.myRegistration,
      status: row.status,
      moderationReason: row.status === 'published' ? null : row.moderationReason,
      review: reviews.get(row.id) ?? null,
    });
  }
  return { items, total };
}

// ---------- Для панели организатора (участник 2) ----------

const organizerColumns = {
  ...registrationColumns,
  user: { id: users.id, name: users.name, avatarUrl: users.avatarUrl, about: users.about },
};

type OrganizerRow = {
  id: string;
  status: RegistrationStatus;
  message: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  user: Omit<OrganizerRegistration['user'], 'reliability'>;
};

/** Записи с надёжностью каждого человека: организатор видит её, решая по заявке. */
async function toOrganizerRegistrations(rows: OrganizerRow[]): Promise<OrganizerRegistration[]> {
  const summaries = await participantSummaries([...new Set(rows.map((row) => row.user.id))]);
  return rows.map((row) => ({
    id: row.id,
    ...toMyRegistration(row),
    user: { ...row.user, reliability: summaries.get(row.user.id)! },
  }));
}

/** Записи события для его автора: сначала ожидающие решения, затем самые свежие. */
export async function listRegistrationsForAuthor(
  executor: Db,
  args: { eventId: string; actorId: string; status?: RegistrationStatus },
): Promise<OrganizerRegistrations> {
  const [event] = await executor
    .select({ createdBy: events.createdBy, capacity: events.capacity })
    .from(events)
    .where(eq(events.id, args.eventId));
  if (!event) throw eventNotFound();
  if (event.createdBy !== args.actorId) throw notAuthor();

  const [rows, totals] = await Promise.all([
    executor
      .select(organizerColumns)
      .from(registrations)
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(
        and(
          eq(registrations.eventId, args.eventId),
          args.status ? eq(registrations.status, args.status) : undefined,
        ),
      )
      .orderBy(
        sql`case when ${registrations.status} = 'pending' then 0 else 1 end`,
        // updated_at, а не created_at: повторная заявка после отмены тоже считается свежей.
        desc(registrations.updatedAt),
      ),
    executor
      .select({ status: registrations.status, value: count() })
      .from(registrations)
      .where(eq(registrations.eventId, args.eventId))
      .groupBy(registrations.status),
  ]);

  const counts = Object.fromEntries(REGISTRATION_STATUSES.map((status) => [status, 0])) as Record<
    RegistrationStatus,
    number
  >;
  for (const { status, value } of totals) counts[status] = value;
  return { items: await toOrganizerRegistrations(rows), counts, capacity: event.capacity };
}

/** Принять или отклонить заявку. Решает только автор события и только ожидающую заявку. */
export async function decideRegistration(
  executor: Db,
  args: { eventId: string; registrationId: string; actorId: string; decision: Decision },
): Promise<OrganizerRegistration> {
  const decided = await executor.transaction(async (tx) => {
    const event = await lockEvent(tx, args.eventId);
    // Автора проверяем раньше заявки: чужой не узнает, есть ли такая заявка.
    if (event.createdBy !== args.actorId) throw notAuthor();

    const [registration] = await tx
      .select({ id: registrations.id, status: registrations.status })
      .from(registrations)
      .where(
        and(eq(registrations.id, args.registrationId), eq(registrations.eventId, args.eventId)),
      );
    if (!registration) throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Заявка не найдена');
    if (registration.status !== 'pending') {
      throw new AppError(409, 'NOT_PENDING', 'Заявка уже рассмотрена');
    }
    if (event.status !== 'published') {
      throw new AppError(409, 'EVENT_UNAVAILABLE', 'Событие снято с публикации');
    }
    if (isPast(event, new Date())) throw new AppError(409, 'EVENT_PAST', 'Событие уже прошло');
    if (
      args.decision === 'confirm' &&
      event.capacity !== null &&
      (await countConfirmed(tx, args.eventId)) >= event.capacity
    ) {
      throw new AppError(
        409,
        'EVENT_FULL',
        'Свободных мест нет: увеличьте лимит или отклоните заявку',
      );
    }

    await tx
      .update(registrations)
      .set({
        status: args.decision === 'confirm' ? 'confirmed' : 'rejected',
        decidedBy: args.actorId,
        decidedAt: new Date(),
      })
      .where(eq(registrations.id, registration.id));
    const [row] = await tx
      .select(organizerColumns)
      .from(registrations)
      .innerJoin(users, eq(users.id, registrations.userId))
      .where(eq(registrations.id, registration.id));
    return row;
  });
  const [item] = await toOrganizerRegistrations([decided]);
  return item!;
}
