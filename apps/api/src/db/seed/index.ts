// Демо-данные. Владелец: участник 3 (seed, задача 3.7).
// SEED_VERSION поднимаем при каждом изменении данных ниже. На деплое (SEED_ON_START=true) сервер
// пересоздаёт данные только при новой версии, поэтому перезапуск не стирает созданное экспертами.
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@sport/shared';
import { eq, getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { hashPassword } from '../../modules/auth/password';
import type { Db } from '../client';
import * as schema from '../schema';

export const SEED_VERSION = 1;
const VERSION_KEY = 'seed_version';

// Стартовый каталог из DATA_MODEL.md. slug — нормализованное название (нижний регистр, ё → е).
const START_SPORTS = [
  'Футбол',
  'Баскетбол',
  'Волейбол',
  'Бег',
  'Шахматы',
  'Йога',
  'Зарядка во дворе',
  'Настольный теннис',
  'Плавание',
  'Велоспорт',
];

/** Стереть все данные и наполнить базу заново. */
export async function seed(db: Db) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async (tx) => {
    const tables = Object.values(schema as Record<string, unknown>)
      .filter((value): value is PgTable => is(value, PgTable))
      .map((table) => `"${getTableName(table)}"`);
    await tx.execute(sql.raw(`truncate table ${tables.join(', ')} restart identity cascade`));

    await tx.insert(schema.users).values(
      DEMO_ACCOUNTS.map((account) => ({
        role: account.role,
        name: account.name,
        email: account.email,
        passwordHash,
        isDemo: true,
      })),
    );
    await tx
      .insert(schema.sports)
      .values(
        START_SPORTS.map((name) => ({ name, slug: name.toLowerCase().replaceAll('ё', 'е') })),
      );

    await tx
      .insert(schema.appMeta)
      .values({ key: VERSION_KEY, value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: schema.appMeta.key, set: { value: String(SEED_VERSION) } });
  });
}

/** Наполнить базу, только если демо-данные в коде новее записанных. Возвращает true, если наполнял. */
export async function seedIfOutdated(db: Db) {
  const [row] = await db
    .select({ value: schema.appMeta.value })
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, VERSION_KEY));
  if (row && Number(row.value) >= SEED_VERSION) return false;
  await seed(db);
  return true;
}
