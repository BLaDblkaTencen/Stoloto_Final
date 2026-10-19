// Переменные окружения: читаются из .env в корне репозитория и проверяются при старте,
// чтобы ошибка в настройке была видна сразу, а не при первом запросе.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL должен начинаться с postgres://'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SEED_ON_START: z.stringbool().default(false),
});

// Вне продакшна без .env берём локальную базу из .env.example: так тесты, которым база
// не нужна, запускаются сразу после клонирования. В проде DATABASE_URL обязателен.
const LOCAL_DATABASE_URL = 'postgres://sport:sport@127.0.0.1:5432/sport';
const parsed = schema.safeParse({
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === 'production' ? undefined : LOCAL_DATABASE_URL),
});
if (!parsed.success) {
  console.error('Ошибка в переменных окружения (см. .env.example):');
  for (const issue of parsed.error.issues)
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
