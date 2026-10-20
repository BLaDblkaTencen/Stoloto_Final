// Каталог видов спорта и «свой вариант» (задача 1.1). Владелец: участник 1.
import {
  normalizeSportName,
  sportSlug,
  type Sport,
  type SportsQuery,
} from '@sport/shared/schemas/sports';
import { and, asc, desc, eq, exists, gt, ilike, sql, type SQL } from 'drizzle-orm';
import { db, type Tx } from '../../db/client';
import { events, sports } from '../../db/schema';
import { errors } from '../../lib/errors';

export const sportColumns = {
  id: sports.id,
  name: sports.name,
  slug: sports.slug,
  isCustom: sports.isCustom,
};

/**
 * Главные виды спорта в порядке важности. На главной при равном числе встреч идут первыми:
 * иначе при одинаковой популярности решал бы алфавит, и «Зарядка во дворе» вытесняла бы футбол.
 */
const MAIN_SPORTS = [
  'футбол',
  'бег',
  'баскетбол',
  'волейбол',
  'плавание',
  'йога',
  'велоспорт',
  'шахматы',
  'настольный теннис',
];

/** Экранировать % и _ для ILIKE, чтобы поиск «100%» не превращался в шаблон. */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/**
 * Стартовый список, затем добавленные пользователями; внутри — по алфавиту.
 * С top — только виды с предстоящими встречами, самые популярные первыми, при равенстве —
 * главные (MAIN_SPORTS), не больше top.
 */
export async function listSports(query: SportsQuery): Promise<Sport[]> {
  const conditions: SQL[] = [];
  if (query.top) {
    // Запрос к одной таблице sports: Drizzle пишет её колонки без имени таблицы, поэтому
    // подзапрос ссылается на "sports"."id" явно, иначе "id" достался бы таблице events.
    const upcomingCount = sql<number>`(
      select count(*)::int from ${events} e
      where e.sport_id = "sports"."id" and e.status = 'published' and e.starts_at > now()
    )`;
    return db
      .select(sportColumns)
      .from(sports)
      .where(sql`${upcomingCount} > 0`)
      .orderBy(
        desc(upcomingCount),
        // Не из списка главных — после них; среди остальных стартовые раньше своих, по алфавиту.
        sql`array_position(array[${sql.join(
          MAIN_SPORTS.map((slug) => sql`${slug}`),
          sql`, `,
        )}]::text[], "sports"."slug") nulls last`,
        asc(sports.isCustom),
        asc(sports.name),
      )
      .limit(query.top);
  }
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
