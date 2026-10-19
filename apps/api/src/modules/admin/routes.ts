// Модуль admin. Владелец: участник 3.
// Админка: допуск организаций, снятие и удаление событий, скрытие комментариев (3.4–3.6).
// Все маршруты — только для роли admin. Контракт — docs/api/core.md.
import {
  adminEventsQuery,
  adminOrganizationsQuery,
  moderationReasonBody,
} from '@sport/shared/schemas/admin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { isUuid } from '../../lib/db-errors';
import { AppError, parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import { deleteEvent, getEvent, hideComment, listEvents, unpublishEvent } from './events';
import {
  approveOrganization,
  getOrganization,
  listOrganizations,
  rejectOrganization,
} from './organizations';

/** :id из адреса; не UUID — такого объекта нет. */
function idParam(request: FastifyRequest, notFound: () => AppError) {
  const { id } = request.params as { id: string };
  if (!isUuid(id)) throw notFound();
  return id;
}

const orgNotFound = () => new AppError(404, 'ORG_NOT_FOUND', 'Организация не найдена');
const eventNotFound = () => new AppError(404, 'EVENT_NOT_FOUND', 'Мероприятие не найдено');
const commentNotFound = () => new AppError(404, 'COMMENT_NOT_FOUND', 'Сообщение не найдено');
const reasonOf = (request: FastifyRequest) => parse(moderationReasonBody, request.body).reason;

const routes: FastifyPluginAsync = async (app) => {
  // Хук действует только на маршруты этого модуля.
  app.addHook('preHandler', requireRole('admin'));

  app.get('/admin/organizations', async (request) =>
    listOrganizations(parse(adminOrganizationsQuery, request.query)),
  );
  app.get('/admin/organizations/:id', async (request) =>
    getOrganization(idParam(request, orgNotFound)),
  );
  app.post('/admin/organizations/:id/approve', async (request) =>
    approveOrganization(currentUser(request).id, idParam(request, orgNotFound)),
  );
  app.post('/admin/organizations/:id/reject', async (request) =>
    rejectOrganization(currentUser(request).id, idParam(request, orgNotFound), reasonOf(request)),
  );

  app.get('/admin/events', async (request) => listEvents(parse(adminEventsQuery, request.query)));
  app.get('/admin/events/:id', async (request) => getEvent(idParam(request, eventNotFound)));
  app.post('/admin/events/:id/unpublish', async (request) =>
    unpublishEvent(currentUser(request).id, idParam(request, eventNotFound), reasonOf(request)),
  );
  app.post('/admin/events/:id/delete', async (request) =>
    deleteEvent(currentUser(request).id, idParam(request, eventNotFound), reasonOf(request)),
  );

  app.post('/admin/comments/:id/hide', async (request) =>
    hideComment(currentUser(request).id, idParam(request, commentNotFound), reasonOf(request)),
  );
};

export default routes;
