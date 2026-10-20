// Сборка сервера: общие плагины, обработка ошибок, модули и раздача фронтенда в проде.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { z } from 'zod';
import { isProduction } from './env';
import { errors, registerErrorHandling } from './lib/errors';
import { registerModules } from './modules';
import { registerAuth } from './modules/auth/guards';

// Стандартные ошибки Zod по-русски: там, где в схеме не задан свой текст (например, limit=abc).
z.config(z.locales.ru());

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: { level: isProduction ? 'info' : 'warn' },
    // На Render запросы приходят через прокси: так rate-limit видит настоящий IP пользователя.
    trustProxy: isProduction,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Плитки карты: Leaflet берёт их с tile.openstreetmap.org, старые адреса — с a/b/c.tile….
        // Маска *.tile… не покрывает адрес без поддомена, поэтому нужны обе записи.
        imgSrc: [
          "'self'",
          'data:',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.org',
        ],
        // Leaflet ставит позиции меток через style, поэтому inline-стили разрешены.
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
    // Сервер плиток OSM отказывает запросам без Referer, а helmet по умолчанию шлёт no-referrer.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
  await app.register(cookie);
  // Лимит включается на конкретных маршрутах (вход, регистрация): config.rateLimit.
  await app.register(rateLimit, { global: false });

  registerErrorHandling(app);
  registerAuth(app);
  await registerModules(app);

  // В проде один процесс отдаёт и API, и собранный фронтенд: один адрес, без CORS.
  if (isProduction && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
      // В имени файлов из assets/ есть хэш содержимого: их можно кэшировать надолго.
      // index.html — нет, иначе после деплоя браузер держал бы старую версию.
      setHeaders: (reply, filePath) => {
        const cache = /[\\/]assets[\\/]/.test(filePath)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';
        reply.header('cache-control', cache);
      },
    });
  }
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api') || !isProduction) {
      throw errors.notFound();
    }
    // Маршруты интерфейса (/events/42 и т.п.) обрабатывает React Router.
    return reply.sendFile('index.html');
  });

  return app;
}
