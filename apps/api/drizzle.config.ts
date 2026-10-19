// Настройка drizzle-kit: pnpm db:push синхронизирует базу со схемой без файлов миграций.
// Команда запускается из apps/api, поэтому .env ищем двумя уровнями выше.
import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const url = process.env.DATABASE_URL;
if (!url) throw new Error('Не задан DATABASE_URL: скопируйте .env.example в .env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  dbCredentials: { url },
  // Без strict: push не спрашивает подтверждения каждого изменения и работает без терминала
  // (на деплое). Об изменениях с потерей данных drizzle-kit всё равно предупреждает.
  verbose: true,
});
