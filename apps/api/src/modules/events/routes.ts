// Модуль events. Владелец: участник 1.
// Мероприятия: лента, поиск, карточка, создание и редактирование (1.2–1.5). Контракт — docs/api/events.md.
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import {
  createEventSchema,
  eventListQuerySchema,
  myEventsQuerySchema,
  updateEventSchema,
} from '@sport/shared/schemas/events';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import {
  createEvent,
  eventNotFound,
  getEventDetails,
  listEvents,
  listMapEvents,
  listMyEvents,
  updateEvent,
} from './service';

/** id из пути; не UUID — такого события нет (404, а не 422 и не ошибка базы). */
export function eventIdFrom(params: unknown): string {
  const result = z.object({ id: z.uuid() }).safeParse(params);
  if (!result.success) throw eventNotFound();
  return result.data.id;
}

const organizers = requireRole('user', 'organization');

const routes: FastifyPluginAsync = async (app) => {
  app.get('/events', async (request) => {
    const query = parse(eventListQuerySchema, request.query);
    return query.view === 'map' ? listMapEvents(query) : listEvents(query, request.user);
  });

  // Объявлен до /events/:id: статический путь Fastify проверяет раньше параметра.
  app.get('/events/mine', { preHandler: organizers }, async (request) =>
    listMyEvents(parse(myEventsQuerySchema, request.query), currentUser(request)),
  );

  app.get('/events/:id', async (request) =>
    getEventDetails(eventIdFrom(request.params), request.user),
  );

  app.post('/events', { preHandler: organizers }, async (request, reply) => {
    const user = currentUser(request);
    const id = await createEvent(parse(createEventSchema, request.body), user);
    return reply.status(201).send(await getEventDetails(id, user));
  });

  app.patch('/events/:id', { preHandler: organizers }, async (request) => {
    const user = currentUser(request);
    const id = eventIdFrom(request.params);
    await updateEvent(id, parse(updateEventSchema, request.body), user);
    return getEventDetails(id, user);
  });
};

export default routes;
