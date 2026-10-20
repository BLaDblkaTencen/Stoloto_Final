// Модуль reviews. Владелец: участник 1.
// Отзывы после встречи: участник оценивает организатора, организатор отмечает участников, профиль
// и страница клуба показывают итог. Контракт — docs/api/events.md, раздел «Отзывы».
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { attendanceSchema, participantReviewSchema } from '@sport/shared/schemas/reviews';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import { eventIdFrom } from '../events/service';
import { orgNotFound } from '../organizations/rules';
import { userIdFrom } from '../profiles/service';
import {
  getAttendance,
  getOrganizationReviews,
  getUserReviews,
  saveAttendance,
  submitParticipantReview,
} from './service';

// Оценивают встречу участники; отмечает участников её автор — человек или аккаунт клуба.
const participants = requireRole('user');
const organizers = requireRole('user', 'organization');

function orgIdFrom(params: unknown): string {
  const result = z.object({ id: z.uuid() }).safeParse(params);
  if (!result.success) throw orgNotFound();
  return result.data.id;
}

const routes: FastifyPluginAsync = async (app) => {
  app.put('/events/:id/review', { preHandler: participants }, async (request) =>
    submitParticipantReview(
      eventIdFrom(request.params),
      currentUser(request),
      parse(participantReviewSchema, request.body),
    ),
  );

  app.get('/events/:id/attendance', { preHandler: organizers }, async (request) =>
    getAttendance(eventIdFrom(request.params), currentUser(request)),
  );

  app.put('/events/:id/attendance', { preHandler: organizers }, async (request) =>
    saveAttendance(
      eventIdFrom(request.params),
      currentUser(request),
      parse(attendanceSchema, request.body),
    ),
  );

  app.get('/users/:id/reviews', async (request) => getUserReviews(userIdFrom(request.params)));

  app.get('/organizations/:id/reviews', async (request) =>
    getOrganizationReviews(orgIdFrom(request.params)),
  );
};

export default routes;
