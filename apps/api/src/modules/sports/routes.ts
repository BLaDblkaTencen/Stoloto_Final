// Модуль sports. Владелец: участник 1.
// Каталог видов спорта и «свой вариант» (задача 1.1). Контракт — docs/api/events.md.
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import { sportsQuerySchema } from '@sport/shared/schemas/sports';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { listSports } from './service';

const routes: FastifyPluginAsync = async (app) => {
  app.get('/sports', async (request) => ({
    items: await listSports(parse(sportsQuerySchema, request.query)),
  }));
};

export default routes;
