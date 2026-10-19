// Модуль admin. Владелец: участник 3.
// Админка: допуск организаций, снятие событий, скрытие комментариев (3.4–3.6). Только этот модуль меняет поля модерации в чужих таблицах (DATA_MODEL.md, «Кто меняет данные»).
// Плагин подключён в modules/index.ts с префиксом /api; пути пишем полностью, например /events/:id.
import type { FastifyPluginAsync } from 'fastify';

const routes: FastifyPluginAsync = async (_app) => {};

export default routes;
