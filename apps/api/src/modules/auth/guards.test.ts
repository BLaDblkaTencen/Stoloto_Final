import type { UserRole } from '@sport/shared';
import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { registerErrorHandling } from '../../lib/errors';
import { currentUser, requireAuth, requireRole } from './guards';

// Вместо сессии из базы роль приходит в тестовом заголовке: проверяем только сами правила доступа.
const app = Fastify({ logger: false });
registerErrorHandling(app);
app.decorateRequest('user', null);
app.addHook('onRequest', async (request) => {
  const role = request.headers['x-test-role'] as UserRole | undefined;
  request.user = role ? { id: 'u1', role, name: 'Тест', email: 't@demo.local' } : null;
});
app.get('/me', { preHandler: requireAuth }, (request) => ({ role: currentUser(request).role }));
app.get('/admin', { preHandler: requireRole('admin') }, () => ({ ok: true }));
app.get('/organizers', { preHandler: requireRole('user', 'organization') }, () => ({ ok: true }));
afterAll(() => app.close());

const call = (url: string, role?: UserRole) =>
  app.inject({ url, headers: role ? { 'x-test-role': role } : {} });

describe('проверка ролей', () => {
  it('без входа — 401 UNAUTHORIZED', async () => {
    const res = await call('/me');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('вошедшему отдаёт пользователя', async () => {
    expect((await call('/me', 'user')).json()).toEqual({ role: 'user' });
  });

  it('чужая роль — 403 FORBIDDEN', async () => {
    const res = await call('/admin', 'organization');
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('пускает нужную роль и любую из нескольких', async () => {
    expect((await call('/admin', 'admin')).statusCode).toBe(200);
    expect((await call('/organizers', 'user')).statusCode).toBe(200);
    expect((await call('/organizers', 'organization')).statusCode).toBe(200);
    expect((await call('/organizers', 'admin')).statusCode).toBe(403);
  });
});
