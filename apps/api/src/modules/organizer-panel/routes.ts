// Модуль organizer-panel. Владелец: участник 2.
// Панель организатора (2.7): участники и заявки события. Правила решений и проверка автора — в сервисе
// модуля registrations (участник 1), здесь только маршруты. Контракт — docs/api/organizations.md, раздел 2.
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import {
  decisionSchema,
  organizerRegistrationsQuerySchema,
} from '@sport/shared/schemas/registrations';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client';
import { AppError, parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import { eventIdFrom } from '../events/service';
import { decideRegistration, listRegistrationsForAuthor } from '../registrations/service';

// Организатором бывает и участник, и организация; что это автор события, проверяет сервис.
const organizers = requireRole('user', 'organization');

function registrationIdFrom(params: unknown): string {
  const result = z.object({ registrationId: z.uuid() }).safeParse(params);
  if (!result.success) throw new AppError(404, 'REGISTRATION_NOT_FOUND', 'Заявка не найдена');
  return result.data.registrationId;
}

const routes: FastifyPluginAsync = async (app) => {
  app.get('/events/:id/organizer/registrations', { preHandler: organizers }, async (request) =>
    listRegistrationsForAuthor(db, {
      eventId: eventIdFrom(request.params),
      actorId: currentUser(request).id,
      status: parse(organizerRegistrationsQuerySchema, request.query).status,
    }),
  );

  app.post(
    '/events/:id/organizer/registrations/:registrationId/decision',
    { preHandler: organizers },
    async (request) =>
      decideRegistration(db, {
        eventId: eventIdFrom(request.params),
        registrationId: registrationIdFrom(request.params),
        actorId: currentUser(request).id,
        decision: parse(decisionSchema, request.body).decision,
      }),
  );
};

export default routes;
