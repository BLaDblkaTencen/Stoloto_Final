// Вход и регистрация на настоящей базе. Нужны pnpm db:push и pnpm db:seed (демо-аккаунты).
// Если база недоступна, тесты пропускаются. Созданные здесь пользователи удаляются в конце.
import { DEMO_PASSWORD } from '@sport/shared';
import { like, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { db, sqlClient } from '../../db/client';
import { users } from '../../db/schema';

const dbAvailable = await db.execute(sql`select 1`).then(
  () => true,
  () => false,
);

const run = Date.now().toString(36);
const testEmail = (name: string) => `test-${run}-${name}@test.local`;

describe.skipIf(!dbAvailable)('вход и регистрация', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildApp();
  });
  afterAll(async () => {
    await db.delete(users).where(like(users.email, `test-${run}-%`));
    await app.close();
    await sqlClient.end();
  });

  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  const register = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/auth/register', payload });
  const me = (cookie?: string) =>
    app.inject({ url: '/api/auth/me', headers: cookie ? { cookie } : {} });
  const sidCookie = (res: { cookies: { name: string; value: string }[] }) =>
    `sid=${res.cookies.find((c) => c.name === 'sid')?.value}`;

  it('демо-аккаунт входит, cookie защищена, хэш пароля не уходит наружу', async () => {
    const res = await login('admin@demo.local', DEMO_PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({
      id: expect.any(String),
      role: 'admin',
      name: 'Администратор',
      email: 'admin@demo.local',
    });
    const cookie = res.cookies.find((c) => c.name === 'sid');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect((await me(sidCookie(res))).json().user.role).toBe('admin');
  });

  it('email без учёта регистра и пробелов', async () => {
    expect((await login('  USER1@Demo.Local ', DEMO_PASSWORD)).statusCode).toBe(200);
  });

  it('неверный пароль и неизвестный email — одинаковый ответ 401', async () => {
    const wrongPassword = await login('user1@demo.local', 'не-тот-пароль');
    const unknownEmail = await login(testEmail('nobody'), 'любой-пароль');
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual(unknownEmail.json());
    expect(wrongPassword.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('без входа /me отвечает user: null', async () => {
    const res = await me();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: null });
  });

  it('регистрация сразу входит; второй раз тот же email — 409', async () => {
    const email = testEmail('anna');
    const res = await register({
      name: ' Анна ',
      email,
      password: 'надёжный-пароль',
      role: 'organization',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ name: 'Анна', email, role: 'organization' });
    expect((await me(sidCookie(res))).json().user.email).toBe(email);

    const again = await register({
      name: 'Другая',
      email: email.toUpperCase(),
      password: 'другой-пароль',
      role: 'user',
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toMatchObject({
      code: 'EMAIL_TAKEN',
      fields: { email: expect.any(String) },
    });
  });

  it('роль admin регистрацией не получить, поля проверяются', async () => {
    const res = await register({
      name: '',
      email: 'не-email',
      password: 'короткий',
      role: 'admin',
    });
    expect(res.statusCode).toBe(422);
    expect(Object.keys(res.json().error.fields).sort()).toEqual(['email', 'name', 'role']);
    const short = await register({
      name: 'Иван',
      email: testEmail('short'),
      password: '1234567',
      role: 'user',
    });
    expect(short.json().error.fields).toEqual({
      password: 'Пароль должен быть не короче 8 символов',
    });
  });

  it('выход удаляет сессию: старая cookie больше не действует', async () => {
    const cookie = sidCookie(await login('user1@demo.local', DEMO_PASSWORD));
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(res.statusCode).toBe(204);
    expect(res.cookies.find((c) => c.name === 'sid')?.value).toBe('');
    expect((await me(cookie)).json()).toEqual({ user: null });
  });

  it('подбор пароля: после 10 попыток — 429, другой email с того же IP входит', async () => {
    const target = testEmail('bruteforce');
    for (let i = 0; i < 10; i++) expect((await login(target, `пароль-${i}`)).statusCode).toBe(401);
    const blocked = await login(target, 'ещё-попытка');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
    expect((await login('org.approved@demo.local', DEMO_PASSWORD)).statusCode).toBe(200);
  });
});
