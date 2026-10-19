// Модуль organizations. Владелец: участник 2.
// Организации: заявка, кабинет, публичная страница (2.1–2.5). Контракт — docs/api/organizations.md.
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import {
  createOrganizationBody,
  organizationListQuery,
  updateOrganizationBody,
} from '@sport/shared/schemas/organizations';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import * as service from './service';

const routes: FastifyPluginAsync = async (app) => {
  const asOrganization = { preHandler: requireRole('organization') };

  app.post('/organizations', asOrganization, async (request, reply) => {
    const body = parse(createOrganizationBody, request.body);
    return reply.status(201).send(await service.createOrganization(currentUser(request), body));
  });

  // Статические пути /organizations/me Fastify сопоставляет раньше, чем /organizations/:id.
  app.get('/organizations/me', asOrganization, async (request) =>
    service.getMyOrganization(currentUser(request)),
  );

  app.patch('/organizations/me', asOrganization, async (request) =>
    service.updateMyOrganization(currentUser(request), parse(updateOrganizationBody, request.body)),
  );

  app.post('/organizations/me/resubmit', asOrganization, async (request) =>
    service.resubmitMyOrganization(currentUser(request)),
  );

  app.get('/organizations', async (request) =>
    service.listOrganizations(parse(organizationListQuery, request.query)),
  );

  app.get<{ Params: { id: string } }>('/organizations/:id', async (request) =>
    service.getOrganization(request.params.id, request.user),
  );
};

export default routes;
