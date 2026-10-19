// Каталог видов спорта и «свой вариант» (задача 1.1). Владелец: участник 1.
import {
  normalizeSportName,
  sportSlug,
  type Sport,
  type SportsQuery,
} from '@sport/shared/schemas/sports';
import { and, asc, eq, exists, gt, ilike, sql, type SQL } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { events, sports } from '../../db/schema';
import { errors } from '../../lib/errors';

export const sportColumns = {
  id: sports.id,
  name: sports.name,
  slug: sports.slug,
  isCustom: sports.isCustom,
};

/** Экранировать % и _ для ILIKE, чтобы поиск «100%» не превращался в шаблон. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** Стартовый список, затем добавленные пользователями; внутри — по алфавиту. */
export async function listSports(query: SportsQuery): Promise<Sport[]> {
  const conditions: SQL[] = [];
  if (query.q) {
    conditions.push(ilike(sports.slug, `%${escapeLike(sportSlug(query.q))}%`));
  }
  if (query.withEvents) {
    const upcoming = db
      .select({ one: sql`1` })
      .from(events)
      .where(
        and(
          eq(events.sportId, sports.id),
          eq(events.status, 'published'),
          gt(events.startsAt, sql`now()`),
        ),
      );
    conditions.push(exists(upcoming));
  }
  return db
    .select(sportColumns)
    .from(sports)
    .where(and(...conditions))
    .orderBy(asc(sports.isCustom), asc(sports.name));
}

/**
 * Вид спорта для события: выбранный из списка или «свой вариант».
 * Свой вариант ищется по нормализованному ключу: «футбол » найдёт «Футбол», а новое название
 * попадёт в каталог без правки кода. Вставка с ON CONFLICT защищает от гонки двух одинаковых заявок.
 */
export async function resolveSport(
  tx: Tx,
  input: { sportId?: string; sportName?: string },
  userId: string,
): Promise<Sport> {
  if (input.sportId) {
    const [sport] = await tx.select(sportColumns).from(sports).where(eq(sports.id, input.sportId));
    if (!sport) throw errors.validation({ sportId: 'Такого вида спорта нет в списке' });
    return sport;
  }
  if (!input.sportName) throw errors.validation({ sportId: 'Выберите вид спорта' });

  const name = normalizeSportName(input.sportName);
  const slug = sportSlug(name);
  await tx
    .insert(sports)
    .values({ name, slug, isCustom: true, createdBy: userId })
    .onConflictDoNothing({ target: sports.slug });
  const [sport] = await tx.select(sportColumns).from(sports).where(eq(sports.slug, slug));
  if (!sport) throw new Error(`Вид спорта «${slug}» не найден после вставки`);
  return sport;
}
