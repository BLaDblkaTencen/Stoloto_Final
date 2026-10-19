// Кто делает запрос и что ему можно. Владелец: участник 3 (auth).
// Права всегда по роли из сессии на сервере, а не по данным от клиента.
//
// В маршруте:
//   app.post('/organizations', { preHandler: requireRole('organization') }, async (request) => {
//     const user = currentUser(request); // гарантированно есть и с нужной ролью
//   });
import type { UserRole } from '@sport/shared';
import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { errors } from '../../lib/errors';
import { findSessionUser, SESSION_COOKIE, type SessionUser } from './session';

declare module 'fastify' {
  interface FastifyRequest {
    /** Вошедший пользователь или null. Заполняется до обработчиков маршрутов. */
    user: SessionUser | null;
  }
}

/** Подключить определение пользователя по cookie ко всем маршрутам. Вызывается в app.ts. */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE];
    request.user = token ? await findSessionUser(token) : null;
  });
}

/** Пользователь запроса; 401, если вход не выполнен. */
export function currentUser(request: FastifyRequest): SessionUser {
  if (!request.user) throw errors.unauthorized();
  return request.user;
}

/** Только для вошедших. */
export const requireAuth: preHandlerAsyncHookHandler = async (request) => {
  currentUser(request);
};

/** Только для перечисленных ролей: 401 без входа, 403 с другой ролью. */
export function requireRole(...roles: UserRole[]): preHandlerAsyncHookHandler {
  return async (request) => {
    const user = currentUser(request);
    if (!roles.includes(user.role)) throw errors.forbidden();
  };
}
