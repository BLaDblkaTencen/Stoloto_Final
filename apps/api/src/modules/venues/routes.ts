// Модуль venues. Владелец: участник 2.
// Площадки и подходящие виду спорта типы площадок для карты (2.8). Контракт — docs/api/organizations.md.
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { venuesQuery } from '@sport/shared/schemas/venues';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import * as service from './service';

// Справочник меняется только сидом: браузер может держать ответ недолго.
const CACHE_HEADER = 'public, max-age=60';

const routes: FastifyPluginAsync = async (app) => {
  app.get('/venues', async (request, reply) => {
    const result = await service.listVenues(parse(venuesQuery, request.query));
    return reply.header('cache-control', CACHE_HEADER).send(result);
  });

  app.get<{ Params: { id: string } }>('/venues/:id', async (request, reply) => {
    const venue = await service.getVenue(request.params.id);
    return reply.header('cache-control', CACHE_HEADER).send(venue);
  });

  app.get('/venue-types', async (_request, reply) => {
    const types = await service.getVenueTypes();
    return reply.header('cache-control', 'public, max-age=300').send(types);
  });
};

export default routes;
