// pnpm db:seed — сбросить базу и заново наполнить демо-данными (схема должна быть применена: pnpm db:push).
import { db, sqlClient } from '../client';
import { seed, SEED_VERSION } from './index';

try {
  await seed(db);
  console.log(`Демо-данные загружены (версия ${SEED_VERSION}).`);
} finally {
  await sqlClient.end();
}
