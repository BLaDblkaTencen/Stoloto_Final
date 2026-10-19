import Fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, errors, parse, registerErrorHandling } from './errors';

const app = Fastify({ logger: false });
registerErrorHandling(app);
app.get('/module-error', () => {
  throw new AppError(403, 'ORG_NOT_APPROVED', 'Организация ещё не допущена администратором');
});
app.post('/form', (request) => {
  return parse(z.object({ title: z.string().min(3, 'Слишком короткое название') }), request.body);
});
app.get('/conflict', () => {
  throw errors.conflict('Вы уже записаны');
});
app.get('/crash', () => {
  throw new Error('секретная подробность');
});
afterAll(() => app.close());

describe('единый формат ошибок', () => {
  it('отдаёт код и статус модуля как есть', async () => {
    const res = await app.inject({ url: '/module-error' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({
      error: { code: 'ORG_NOT_APPROVED', message: 'Организация ещё не допущена администратором' },
    });
  });

  it('ошибки Zod превращает в 422 с текстом под каждым полем', async () => {
    const res = await app.inject({ method: 'POST', url: '/form', payload: { title: 'а' } });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте заполнение полей',
        fields: { title: 'Слишком короткое название' },
      },
    });
  });

  it('битый JSON — 400 BAD_REQUEST', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/form',
      headers: { 'content-type': 'application/json' },
      payload: '{не json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });

  it('общие помощники ставят свой статус', async () => {
    const res = await app.inject({ url: '/conflict' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toEqual({ code: 'CONFLICT', message: 'Вы уже записаны' });
  });

  it('неожиданная ошибка — 500 без внутренних подробностей', async () => {
    const res = await app.inject({ url: '/crash' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL');
    expect(res.body).not.toContain('секретная подробность');
  });
});
