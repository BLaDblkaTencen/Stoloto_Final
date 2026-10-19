// Настройки сервера, которые не видны в режиме разработки, но ломают прод.
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';

const app = await buildApp();
afterAll(() => app.close());

describe('политика безопасности (CSP)', () => {
  it('пускает плитки карты OpenStreetMap и с поддоменом, и без', async () => {
    const res = await app.inject({ url: '/api/nope' });
    const imgSrc = String(res.headers['content-security-policy'])
      .split(';')
      .find((directive) => directive.startsWith('img-src'));
    // Leaflet берёт плитки с tile.openstreetmap.org: маска *.tile… этот адрес не покрывает.
    expect(imgSrc).toContain('https://tile.openstreetmap.org');
    expect(imgSrc).toContain('https://*.tile.openstreetmap.org');
  });
});
