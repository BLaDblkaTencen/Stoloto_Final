// Модуль profiles. Владелец: участник 1.
// Профиль пользователя и публичный профиль автора (1.9). Контракт — docs/api/events.md, раздел «Профиль».
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { updateProfileSchema } from '@sport/shared/schemas/profiles';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { currentUser, requireAuth } from '../auth/guards';
import { getProfile, updateMyProfile, userIdFrom } from './service';

const routes: FastifyPluginAsync = async (app) => {
  // Объявлен до /users/:id: статический путь Fastify проверяет раньше параметра.
  app.get('/users/me', { preHandler: requireAuth }, async (request) => {
    const user = currentUser(request);
    return getProfile(user.id, user.id);
  });

  app.patch('/users/me', { preHandler: requireAuth }, async (request) =>
    updateMyProfile(currentUser(request), parse(updateProfileSchema, request.body)),
  );

  app.get('/users/:id', async (request) =>
    getProfile(userIdFrom(request.params), request.user?.id ?? null),
  );
};

export default routes;
