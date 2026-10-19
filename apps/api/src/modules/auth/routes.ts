// Модуль auth. Владелец: участник 3.
// Регистрация, вход, выход, текущий пользователь (задача 3.2). Контракт — docs/api/core.md.
import { loginBody, registerBody, type AuthResponse } from '@sport/shared/schemas/auth';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError, parse } from '../../lib/errors';
import { hashPassword, verifyPassword } from './password';
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  type SessionUser,
} from './session';
import { createUser, findUserByEmail } from './users';

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');

// Лимит считается по связке «IP + email», а не по одному IP: на защите эксперты могут сидеть
// в одной сети, и общий лимит на IP мешал бы им входить под разными аккаунтами.
const byIpAndEmail = (request: FastifyRequest) => {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return `${request.ip}:${typeof email === 'string' ? email.trim().toLowerCase() : ''}`;
};

// Чтобы по времени ответа нельзя было понять, есть ли такой email, пароль проверяется
// и для несуществующего пользователя — против заранее посчитанного хэша.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('нет-такого-пользователя'));

/** Только публичные поля: хэш пароля наружу не уходит. */
const toUser = (user: SessionUser): SessionUser => ({
  id: user.id,
  role: user.role,
  name: user.name,
  email: user.email,
});

const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: byIpAndEmail,
        },
      },
    },
    async (request, reply): Promise<AuthResponse> => {
      const { email, password } = parse(loginBody, request.body);
      const user = await findUserByEmail(email);
      const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
      if (!user || !ok) throw invalidCredentials();

      const token = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
      return { user: toUser(user) };
    },
  );

  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute', hook: 'preHandler' } } },
    async (request, reply): Promise<AuthResponse> => {
      const { password, ...body } = parse(registerBody, request.body);
      if (await findUserByEmail(body.email)) throw emailTaken();

      const user = await createUser({ ...body, passwordHash: await hashPassword(password) }).catch(
        (err: unknown) => {
          // Два одновременных запроса с одним email: второй упрётся в уникальный индекс.
          throw isUniqueViolation(err) ? emailTaken() : err;
        },
      );

      const token = await createSession(user.id);
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions());
      return reply.status(201).send({ user });
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await deleteSession(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });

  // Без входа отвечает { user: null }, а не 401: интерфейс спрашивает это на каждой странице.
  app.get('/auth/me', async (request): Promise<AuthResponse> => ({ user: request.user }));
};

const emailTaken = () =>
  new AppError(409, 'EMAIL_TAKEN', 'Этот email уже зарегистрирован. Войдите или укажите другой', {
    email: 'Этот email уже зарегистрирован',
  });

function isUniqueViolation(err: unknown) {
  const cause = err instanceof Error && 'cause' in err ? err.cause : err;
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
}

export default routes;
