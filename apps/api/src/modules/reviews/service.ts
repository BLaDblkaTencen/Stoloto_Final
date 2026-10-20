// Отзывы после встречи: оставить, отметить участников, посчитать оценку и надёжность. Владелец: участник 1.
// Итоги не хранятся, а считаются запросом по видимым отзывам (visible ниже). «Мои мероприятия»,
// карточка события и панель организатора берут их отсюда. Контракт — docs/api/events.md, «Отзывы».
import {
  REVIEW_WINDOW_DAYS,
  type Attendance,
  type AttendanceData,
  type AttendanceState,
  type MyReview,
  type OrganizationReviews,
  type OrganizerSummary,
  type OrganizerTag,
  type ParticipantReviewData,
  type ParticipantSummary,
  type ParticipantTag,
  type Review,
  type ReviewState,
  type ReviewTag,
  type UserReviews,
} from '@sport/shared/schemas/reviews';
import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type Tx } from '../../db/client';
import { events, organizations, registrations, reviews, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { orgNotFound } from '../organizations/rules';
import { userNotFound } from '../profiles/service';
import {
  attendanceDenial,
  eventEnd,
  isReviewOpen,
  participantReviewDenial,
  ratingSummary,
  reviewClosesAt,
  type ReviewEvent,
} from './rules';

const eventNotFound = () => new AppError(404, 'EVENT_NOT_FOUND', 'Событие не найдено');
const at = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const endedBy = (now: Date) => sql`coalesce(${events.endsAt}, ${events.startsAt}) <= ${at(now)}`;

/**
 * Слепые отзывы: отзыв виден, когда вторая сторона тоже высказалась или окно закрылось.
 * Об организаторе — когда он отметил участников; об участнике — когда тот сам оценил встречу.
 * Так нельзя ответить плохой оценкой на плохую. Снятые и удалённые встречи в итоги не входят.
 * Только для запросов с join events: иначе Drizzle напишет колонки без имён таблиц.
 */
function visible(now: Date): SQL {
  return sql`(${events.status} = 'published' and (
    coalesce(${events.endsAt}, ${events.startsAt}) + ${sql.raw(`interval '${REVIEW_WINDOW_DAYS} days'`)} < ${at(now)}
    or (${reviews.direction} = 'participant_to_organizer' and exists (
      select 1 from reviews c
      where c.event_id = ${reviews.eventId} and c.direction = 'organizer_to_participant'))
    or (${reviews.direction} = 'organizer_to_participant' and exists (
      select 1 from reviews c
      where c.event_id = ${reviews.eventId} and c.direction = 'participant_to_organizer'
        and c.author_id = ${reviews.targetUserId}))
  ))`;
}

/** Сумма и число звёзд по видимым отзывам. */
const ratingColumns = {
  sum: sql<number>`coalesce(sum(${reviews.rating}), 0)::int`,
  rated: sql<number>`count(${reviews.rating})::int`,
};

// ---------- Итоги ----------

/**
 * Надёжность и оценка участников одним запросом на всех: для списка заявок организатора.
 * total — подтверждённые записи на прошедшие встречи; неявка — только отметка организатора,
 * пока он никого не отметил, все считаются пришедшими. Отмена записи неявкой не считается.
 */
export async function participantSummaries(
  userIds: string[],
  now = new Date(),
): Promise<Map<string, ParticipantSummary>> {
  const result = new Map<string, ParticipantSummary>(
    userIds.map((id) => [id, { rating: null, count: 0, attended: 0, total: 0 }]),
  );
  if (userIds.length === 0) return result;

  const [totals, marks] = await Promise.all([
    db
      .select({ userId: registrations.userId, total: count() })
      .from(registrations)
      .innerJoin(events, eq(events.id, registrations.eventId))
      .where(
        and(
          inArray(registrations.userId, userIds),
          eq(registrations.status, 'confirmed'),
          eq(events.status, 'published'),
          endedBy(now),
        ),
      )
      .groupBy(registrations.userId),
    db
      .select({
        userId: reviews.targetUserId,
        noShows: sql<number>`(count(*) filter (where ${reviews.attended} = false))::int`,
        ...ratingColumns,
      })
      .from(reviews)
      .innerJoin(events, eq(events.id, reviews.eventId))
      .where(
        and(
          eq(reviews.direction, 'organizer_to_participant'),
          inArray(reviews.targetUserId, userIds),
          visible(now),
        ),
      )
      .groupBy(reviews.targetUserId),
  ]);

  const noShows = new Map<string, number>();
  for (const row of marks) {
    if (!row.userId) continue;
    noShows.set(row.userId, row.noShows);
    result.set(row.userId, { ...result.get(row.userId)!, ...ratingSummary(row.sum, row.rated) });
  }
  for (const row of totals) {
    const summary = result.get(row.userId)!;
    summary.total = row.total;
    summary.attended = Math.max(0, row.total - (noShows.get(row.userId) ?? 0));
  }
  return result;
}

export type OrganizerTarget = { type: 'user' | 'organization'; id: string };

/** Оценка организатора: человека (его встречи без клуба) или клуба. */
export async function organizerSummary(
  target: OrganizerTarget,
  now = new Date(),
): Promise<OrganizerSummary> {
  const isOrg = target.type === 'organization';
  const [[rating], [{ organized }]] = await Promise.all([
    db
      .select(ratingColumns)
      .from(reviews)
      .innerJoin(events, eq(events.id, reviews.eventId))
      .where(
        and(
          eq(reviews.direction, 'participant_to_organizer'),
          isOrg ? eq(reviews.targetOrgId, target.id) : eq(reviews.targetUserId, target.id),
          visible(now),
        ),
      ),
    db
      .select({ organized: count() })
      .from(events)
      .where(
        and(
          eq(events.status, 'published'),
          endedBy(now),
          isOrg
            ? eq(events.organizationId, target.id)
            : and(eq(events.createdBy, target.id), isNull(events.organizationId)),
        ),
      ),
  ]);
  return { ...ratingSummary(rating?.sum ?? 0, rating?.rated ?? 0), organized };
}

// ---------- Списки отзывов ----------

const reviewAuthor = alias(users, 'review_author');

/** Видимые отзывы с текстом, звёздами или тегами; голая отметка «пришёл» в список не идёт. */
async function listReviews(target: SQL, now: Date): Promise<Review[]> {
  const rows = await db
    .select({
      id: reviews.id,
      direction: reviews.direction,
      rating: reviews.rating,
      tags: reviews.tags,
      comment: reviews.comment,
      attended: reviews.attended,
      updatedAt: reviews.updatedAt,
      authorId: reviews.authorId,
      authorName: reviewAuthor.name,
      eventId: events.id,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      organizationId: events.organizationId,
      organizationName: organizations.name,
    })
    .from(reviews)
    .innerJoin(events, eq(events.id, reviews.eventId))
    .innerJoin(reviewAuthor, eq(reviewAuthor.id, reviews.authorId))
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .where(
      and(
        target,
        visible(now),
        or(
          sql`${reviews.rating} is not null`,
          sql`${reviews.comment} is not null`,
          sql`cardinality(${reviews.tags}) > 0`,
        ),
      ),
    )
    .orderBy(desc(reviews.updatedAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    rating: row.rating,
    tags: row.tags as ReviewTag[],
    comment: row.comment,
    attended: row.attended,
    createdAt: row.updatedAt.toISOString(),
    // Участников клуба отмечает его аккаунт, а подписываем отзыв названием клуба.
    author:
      row.direction === 'organizer_to_participant' && row.organizationId
        ? { type: 'organization', id: row.organizationId, name: row.organizationName ?? '' }
        : { type: 'user', id: row.authorId, name: row.authorName },
    event: { id: row.eventId, title: row.eventTitle, startsAt: row.eventStartsAt.toISOString() },
  }));
}

export async function getUserReviews(userId: string, now = new Date()): Promise<UserReviews> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) throw userNotFound();
  const [asOrganizer, participants, items] = await Promise.all([
    organizerSummary({ type: 'user', id: userId }, now),
    participantSummaries([userId], now),
    // О человеке и как об организаторе, и как об участнике.
    listReviews(eq(reviews.targetUserId, userId), now),
  ]);
  return { asOrganizer, asParticipant: participants.get(userId)!, items };
}

/** Отзывы о клубе. Недопущенного клуба на платформе нет — 404, как у его страницы. */
export async function getOrganizationReviews(
  orgId: string,
  now = new Date(),
): Promise<OrganizationReviews> {
  const [org] = await db
    .select({ status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  if (!org || org.status !== 'approved') throw orgNotFound();
  const [summary, items] = await Promise.all([
    organizerSummary({ type: 'organization', id: orgId }, now),
    listReviews(eq(reviews.targetOrgId, orgId), now),
  ]);
  return { summary, items };
}

// ---------- Состояния для «Моих мероприятий» ----------

type StateRow = ReviewEvent & { id: string };

/** Отзывы о прошедших встречах, где я был подтверждённым участником. */
export async function reviewStates(
  userId: string,
  rows: (StateRow & { myStatus: string | null })[],
  now = new Date(),
): Promise<Map<string, ReviewState>> {
  const eligible = rows.filter(
    (row) =>
      row.myStatus === 'confirmed' &&
      row.status === 'published' &&
      eventEnd(row).getTime() <= now.getTime(),
  );
  if (eligible.length === 0) return new Map();
  const mine = await db
    .select({
      eventId: reviews.eventId,
      rating: reviews.rating,
      tags: reviews.tags,
      comment: reviews.comment,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.authorId, userId),
        eq(reviews.direction, 'participant_to_organizer'),
        inArray(
          reviews.eventId,
          eligible.map((row) => row.id),
        ),
      ),
    );
  const byEvent = new Map(mine.map((review) => [review.eventId, toMyReview(review)]));
  return new Map(
    eligible.map((row) => [
      row.id,
      {
        open: isReviewOpen(row, now),
        closesAt: reviewClosesAt(row).toISOString(),
        mine: byEvent.get(row.id) ?? null,
      },
    ]),
  );
}

/** Отметки участников по прошедшим встречам, которые я организовал. */
export async function attendanceStates(
  rows: StateRow[],
  now = new Date(),
): Promise<Map<string, AttendanceState>> {
  const eligible = rows.filter(
    (row) => row.status === 'published' && eventEnd(row).getTime() <= now.getTime(),
  );
  if (eligible.length === 0) return new Map();
  const marked = await db
    .selectDistinct({ eventId: reviews.eventId })
    .from(reviews)
    .where(
      and(
        eq(reviews.direction, 'organizer_to_participant'),
        inArray(
          reviews.eventId,
          eligible.map((row) => row.id),
        ),
      ),
    );
  const markedIds = new Set(marked.map((row) => row.eventId));
  return new Map(
    eligible.map((row) => [
      row.id,
      {
        open: isReviewOpen(row, now),
        closesAt: reviewClosesAt(row).toISOString(),
        marked: markedIds.has(row.id),
      },
    ]),
  );
}

// ---------- Оставить отзыв и отметить участников ----------

function toMyReview(row: {
  rating: number | null;
  tags: string[];
  comment: string | null;
  updatedAt: Date;
}): MyReview {
  return {
    rating: row.rating ?? 0,
    tags: row.tags as OrganizerTag[],
    comment: row.comment,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Событие с блокировкой строки: отзывы и отметки по одной встрече пишутся по очереди. */
async function lockEvent(tx: Tx, eventId: string) {
  const [event] = await tx
    .select({
      id: events.id,
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      createdBy: events.createdBy,
      organizationId: events.organizationId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .for('update');
  if (!event) throw eventNotFound();
  return event;
}

const fail = (denial: { status: number; code: string; message: string }) =>
  new AppError(denial.status, denial.code, denial.message);

/** Оставить или поправить отзыв об организаторе: о клубе, если встреча от его имени. */
export async function submitParticipantReview(
  eventId: string,
  user: SessionUser,
  input: ParticipantReviewData,
  now = new Date(),
): Promise<MyReview> {
  return db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const [registration] = await tx
      .select({ status: registrations.status })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.userId, user.id)));
    const denial = participantReviewDenial(event, user, registration?.status ?? null, now);
    if (denial) throw fail(denial);

    const values = { rating: input.rating, tags: input.tags, comment: input.comment };
    const [existing] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(
          eq(reviews.eventId, eventId),
          eq(reviews.authorId, user.id),
          eq(reviews.direction, 'participant_to_organizer'),
        ),
      );
    const [row] = existing
      ? await tx.update(reviews).set(values).where(eq(reviews.id, existing.id)).returning()
      : await tx
          .insert(reviews)
          .values({
            eventId,
            authorId: user.id,
            direction: 'participant_to_organizer',
            targetUserId: event.organizationId ? null : event.createdBy,
            targetOrgId: event.organizationId,
            ...values,
          })
          .returning();
    return toMyReview(row!);
  });
}

/** Подтверждённые участники встречи с отметками организатора. Видит только автор события. */
export async function getAttendance(
  eventId: string,
  user: SessionUser,
  now = new Date(),
): Promise<Attendance> {
  const [event] = await db
    .select({
      status: events.status,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      createdBy: events.createdBy,
    })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) throw eventNotFound();
  if (event.createdBy !== user.id) throw fail(attendanceDenial(event, user, now)!);

  const marks = alias(reviews, 'mark');
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      markId: marks.id,
      attended: marks.attended,
      rating: marks.rating,
      tags: marks.tags,
      comment: marks.comment,
    })
    .from(registrations)
    .innerJoin(users, eq(users.id, registrations.userId))
    .leftJoin(
      marks,
      and(
        eq(marks.eventId, registrations.eventId),
        eq(marks.direction, 'organizer_to_participant'),
        eq(marks.targetUserId, registrations.userId),
      ),
    )
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')))
    .orderBy(asc(registrations.createdAt));

  return {
    open: isReviewOpen(event, now),
    closesAt: reviewClosesAt(event).toISOString(),
    items: rows.map((row) => ({
      user: { id: row.id, name: row.name },
      marked: row.markId !== null,
      attended: row.attended ?? true,
      rating: row.rating,
      tags: (row.tags ?? []) as ParticipantTag[],
      comment: row.comment,
    })),
  };
}

/** Сохранить отметки организатора. Отмечать можно только подтверждённых участников встречи. */
export async function saveAttendance(
  eventId: string,
  user: SessionUser,
  input: AttendanceData,
  now = new Date(),
): Promise<Attendance> {
  await db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    const denial = attendanceDenial(event, user, now);
    if (denial) throw fail(denial);

    const confirmed = await tx
      .select({ userId: registrations.userId })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.status, 'confirmed')));
    const participantIds = new Set(confirmed.map((row) => row.userId));
    if (input.marks.some((mark) => !participantIds.has(mark.userId))) {
      throw new AppError(
        422,
        'NOT_PARTICIPANT',
        'Отметить можно только подтверждённых участников встречи',
      );
    }

    const existing = await tx
      .select({ id: reviews.id, userId: reviews.targetUserId })
      .from(reviews)
      .where(and(eq(reviews.eventId, eventId), eq(reviews.direction, 'organizer_to_participant')));
    const existingByUser = new Map(existing.map((row) => [row.userId, row.id]));
    for (const mark of input.marks) {
      const values = {
        attended: mark.attended,
        rating: mark.rating,
        tags: mark.tags,
        comment: mark.comment,
      };
      const id = existingByUser.get(mark.userId);
      if (id) await tx.update(reviews).set(values).where(eq(reviews.id, id));
      else
        await tx.insert(reviews).values({
          eventId,
          authorId: user.id,
          direction: 'organizer_to_participant',
          targetUserId: mark.userId,
          ...values,
        });
    }
  });
  return getAttendance(eventId, user, now);
}
