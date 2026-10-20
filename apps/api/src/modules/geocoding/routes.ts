// Модуль geocoding. Владелец: участник 2.
// Поиск адреса для формы встречи: адрес → точка на карте, точка → адрес. Контракт —
// docs/api/organizations.md, раздел «Поиск адреса». Только для вошедших: форма встречи требует входа,
// а внешний сервис нельзя отдавать анонимному трафику.
import {
  geocodeQuery,
  reverseGeocodeQuery,
  type GeocodeResponse,
  type ReverseGeocodeResponse,
} from '@sport/shared/schemas/geocoding';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/errors';
import { requireAuth } from '../auth/guards';
import { geocoder } from './geocoder';

// Адреса не меняются часами: повторный поиск того же адреса браузер берёт из кэша.
const CACHE_HEADER = 'private, max-age=3600';
// Nominatim — запрос в секунду на весь сервер; с одного человека столько не нужно.
const rateLimit = { max: 30, timeWindow: '1 minute', hook: 'preHandler' } as const;

const routes: FastifyPluginAsync = async (app) => {
  app.get(
    '/geocode',
    { preHandler: requireAuth, config: { rateLimit } },
    async (request, reply) => {
      const { q } = parse(geocodeQuery, request.query);
      const body: GeocodeResponse = { items: await geocoder.search(q) };
      return reply.header('cache-control', CACHE_HEADER).send(body);
    },
  );

  app.get(
    '/geocode/reverse',
    { preHandler: requireAuth, config: { rateLimit } },
    async (request, reply) => {
      const { lat, lng } = parse(reverseGeocodeQuery, request.query);
      const body: ReverseGeocodeResponse = { place: await geocoder.reverse(lat, lng) };
      return reply.header('cache-control', CACHE_HEADER).send(body);
    },
  );
};

export default routes;
