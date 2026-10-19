// Точка входа сервера: pnpm dev (с перезапуском при правках) или pnpm start.
import { buildApp } from './app';
import { db, sqlClient } from './db/client';
import { seedIfOutdated, SEED_VERSION } from './db/seed';
import { env, isProduction } from './env';

const app = await buildApp();

if (env.SEED_ON_START && (await seedIfOutdated(db))) {
  app.log.info(`Демо-данные загружены (версия ${SEED_VERSION})`);
}

await app.listen({ port: env.PORT, host: isProduction ? '0.0.0.0' : '127.0.0.1' });
console.log(`API: http://127.0.0.1:${env.PORT}/api/health`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await sqlClient.end();
    process.exit(0);
  });
}
