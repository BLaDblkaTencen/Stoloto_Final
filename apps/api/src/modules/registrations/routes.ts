// Модуль registrations. Владелец: участник 1.
// Запись в двух режимах и «Мои записи» (1.6). Решения по заявкам принимает панель организатора
// участника 2 через функции service.ts. Контракт — docs/api/events.md, раздел «Запись».
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { joinBodySchema, myRegistrationsQuerySchema } from '@sport/shared/schemas/registrations';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';
import { eventIdFrom } from '../events/service';
import { cancelRegistration, joinEvent, listMyRegistrations } from './service';

// Записываются только участники: у организации и администратора своих записей нет.
const participants = requireRole('user');

const routes: FastifyPluginAsync = async (app) => {
  app.post('/events/:id/registration', { preHandler: participants }, async (request) => {
    const { message } = parse(joinBodySchema, request.body);
    return joinEvent(eventIdFrom(request.params), currentUser(request), message);
  });

  app.delete('/events/:id/registration', { preHandler: participants }, async (request) =>
    cancelRegistration(eventIdFrom(request.params), currentUser(request)),
  );

  app.get('/registrations/mine', { preHandler: participants }, async (request) =>
    listMyRegistrations(parse(myRegistrationsQuerySchema, request.query), currentUser(request)),
  );
};

export default routes;
