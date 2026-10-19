// Модуль core. Владелец: участник 3.
// Служебные маршруты. /api/health нужен для проверки деплоя и «пробуждения» сервера перед показом.
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../db/client';

const routes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok' };
    } catch (err) {
      app.log.error(err, 'База данных недоступна');
      return reply.status(503).send({ status: 'degraded', db: 'error' });
    }
  });
};

export default routes;
