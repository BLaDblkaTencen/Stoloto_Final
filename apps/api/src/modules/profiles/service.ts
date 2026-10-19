// Профиль пользователя и публичный профиль автора события (задача 1.9). Владелец: участник 1.
// Email и пароль здесь не показываются и не меняются: это модуль auth.
import type { EventListItem } from '@sport/shared/schemas/events';
import type { UpdateProfileData, UserProfile } from '@sport/shared/schemas/profiles';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client';
import { events, sports, users, userSports } from '../../db/schema';
import { AppError, errors } from '../../lib/errors';
import type { SessionUser } from '../auth/session';
import { selectEvents, toListItem } from '../events/queries';
import { sportColumns } from '../sports/service';

const UPCOMING_LIMIT = 20;

const userNotFound = () => new AppError(404, 'USER_NOT_FOUND', 'Пользователь не найден');

/** id пользователя из пути; не UUID — такого пользователя нет. */
export function userIdFrom(params: unknown): string {
  const result = z.object({ id: z.uuid() }).safeParse(params);
  if (!result.success) throw userNotFound();
  return result.data.id;
}

async function upcomingEvents(userId: string, viewerId: string | null): Promise<EventListItem[]> {
  const rows = await selectEvents(viewerId)
    .where(
      and(
        eq(events.createdBy, userId),
        eq(events.status, 'published'),
        gt(events.startsAt, new Date()),
      ),
    )
    .orderBy(asc(events.startsAt), asc(events.id))
    .limit(UPCOMING_LIMIT);
  return rows.map(toListItem);
}

export async function getProfile(id: string, viewerId: string | null): Promise<UserProfile> {
  const [[user], interests, upcoming] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, about: users.about, city: users.city })
      .from(users)
      .where(eq(users.id, id)),
    db
      .select(sportColumns)
      .from(userSports)
      .innerJoin(sports, eq(sports.id, userSports.sportId))
      .where(eq(userSports.userId, id))
      .orderBy(asc(sports.isCustom), asc(sports.name)),
    upcomingEvents(id, viewerId),
  ]);
  if (!user) throw userNotFound();
  return { ...user, sports: interests, upcomingEvents: upcoming };
}

export async function updateMyProfile(
  user: SessionUser,
  input: UpdateProfileData,
): Promise<UserProfile> {
  await db.transaction(async (tx) => {
    const { sportIds, ...fields } = input;
    if (Object.values(fields).some((value) => value !== undefined)) {
      await tx.update(users).set(fields).where(eq(users.id, user.id));
    }
    if (sportIds) {
      if (sportIds.length) {
        const found = await tx
          .select({ id: sports.id })
          .from(sports)
          .where(inArray(sports.id, sportIds));
        if (found.length !== sportIds.length) {
          throw errors.validation({ sportIds: 'Такого вида спорта нет в списке' });
        }
      }
      await tx.delete(userSports).where(eq(userSports.userId, user.id));
      if (sportIds.length) {
        await tx
          .insert(userSports)
          .values(sportIds.map((sportId) => ({ userId: user.id, sportId })));
      }
    }
  });
  return getProfile(user.id, user.id);
}
