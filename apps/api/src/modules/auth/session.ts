// Сессии входа. Владелец: участник 3 (auth).
// В cookie лежит случайный токен, в базе — только его SHA-256: утечка таблицы sessions
// не даёт войти чужим аккаунтом.
import { createHash, randomBytes } from 'node:crypto';
import type { UserRole } from '@sport/shared';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { sessions, users } from '../../db/schema';
import { env } from '../../env';

export const SESSION_COOKIE = 'sid';

/** Пользователь текущего запроса: только то, что нужно для прав и шапки сайта. */
export type SessionUser = { id: string; role: UserRole; name: string; email: string };

const ttlMs = () => env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const sessionCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  // Secure только при HTTPS: на Render (за прокси, trustProxy) cookie защищена, а локальный
  // запуск по http://127.0.0.1 не теряет вход после перезагрузки страницы.
  secure: 'auto' as const,
  maxAge: ttlMs() / 1000,
});

/** Создать сессию; вернуть токен для cookie. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + ttlMs()),
  });
  return token;
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Пользователь по токену из cookie; null, если сессии нет или она истекла. */
export async function findSessionUser(token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ id: users.id, role: users.role, name: users.name, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}
