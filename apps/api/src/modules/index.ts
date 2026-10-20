// Подключение модулей API. Владелец: участник 3.
// Каждый модуль — плагин Fastify в своей папке, поэтому участники правят только свои файлы.
// Новый модуль добавляется сюда одной строкой.
import type { FastifyInstance } from 'fastify';
import admin from './admin/routes';
import auth from './auth/routes';
import comments from './comments/routes';
import core from './core/routes';
import events from './events/routes';
import geocoding from './geocoding/routes';
import organizations from './organizations/routes';
import organizerPanel from './organizer-panel/routes';
import profiles from './profiles/routes';
import registrations from './registrations/routes';
import sports from './sports/routes';
import venues from './venues/routes';

const modules = [
  core,
  auth,
  admin,
  sports,
  events,
  registrations,
  comments,
  profiles,
  organizations,
  organizerPanel,
  venues,
  geocoding,
];

export async function registerModules(app: FastifyInstance) {
  for (const plugin of modules) {
    await app.register(plugin, { prefix: '/api' });
  }
}
