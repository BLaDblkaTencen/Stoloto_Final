// Модуль comments. Владелец: участник 1.
// Обсуждение под мероприятием (1.8). Контракт — docs/api/events.md, раздел «Обсуждение».
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { commentBodySchema } from '@sport/shared/schemas/comments';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { currentUser, requireAuth } from '../auth/guards';
import { eventIdFrom } from '../events/service';
import { addComment, listComments } from './service';

const routes: FastifyPluginAsync = async (app) => {
  app.get('/events/:id/comments', async (request) => ({
    items: await listComments(eventIdFrom(request.params), request.user),
  }));

  app.post('/events/:id/comments', { preHandler: requireAuth }, async (request, reply) => {
    const comment = await addComment(
      eventIdFrom(request.params),
      currentUser(request),
      parse(commentBodySchema, request.body),
    );
    return reply.status(201).send(comment);
  });
};

export default routes;
