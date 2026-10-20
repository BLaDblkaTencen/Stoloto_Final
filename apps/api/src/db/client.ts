// Подключение к PostgreSQL. Модули импортируют `db` отсюда.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

// prepare: false — чтобы база могла стоять за пулером вида PgBouncer (например, pooled-адрес Neon):
// он не держит prepared statements. Прямому подключению к Postgres Render это не мешает.
export const sqlClient = postgres(env.DATABASE_URL, { max: 10, prepare: false });
export const db = drizzle(sqlClient, { schema });

export type Db = typeof db;
/** Транзакция; передаётся в сервисы, которые должны выполниться атомарно (запись и лимит мест). */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
