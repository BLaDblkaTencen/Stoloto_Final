import { describe, expect, it, vi } from 'vitest';
import {
  cleanAddress,
  createGeocoder,
  queryVariants,
  toPlace,
  uniquePlaces,
  type NominatimPlace,
} from './geocoder';

describe('cleanAddress', () => {
  it.each([
    ['пр. Мира, 12', 'проспект Мира, 12'],
    ['ул.Весны 23', 'улица Весны 23'],
    ['ул Ленина, д. 22', 'улица Ленина, 22'],
    ['пл. Революции', 'площадь Революции'],
    ['ул. Весны, 23, двор', 'улица Весны, 23'],
    ['Остров Татышев, главный вход', 'Остров Татышев'],
    ['Сбор у главного входа в Покровский парк', 'Покровский парк'],
    ['ул. Ленина, 5, 2 этаж', 'улица Ленина, 5'],
  ])('«%s» → «%s»', (address, expected) => {
    expect(cleanAddress(address)).toBe(expected);
  });

  it('не трогает слова, которые начинаются как сокращения', () => {
    expect(cleanAddress('улица Урицкого, 22')).toBe('улица Урицкого, 22');
    expect(cleanAddress('Дворец спорта имени Ивана Ярыгина')).toBe(
      'Дворец спорта имени Ивана Ярыгина',
    );
    expect(cleanAddress('Пляж у Коммунального моста')).toBe('Пляж у Коммунального моста');
  });
});

describe('queryVariants', () => {
  it('убирает части с конца, пока не найдётся', () => {
    expect(queryVariants('ул. Весны, 23, у фонтана')).toEqual([
      'улица Весны, 23, у фонтана',
      'улица Весны, 23',
      'улица Весны',
    ]);
  });

  it('не больше заданного числа запросов и без повторов', () => {
    expect(queryVariants('проспект Мира, 12, вход с торца, у арки', 2)).toEqual([
      'проспект Мира, 12, вход с торца, у арки',
      'проспект Мира, 12, вход с торца',
    ]);
    expect(queryVariants('Покровский парк', 3)).toEqual(['Покровский парк']);
  });
});

describe('toPlace', () => {
  const base = { lat: '56.0154', lon: '92.8897' };

  it('дом — по улице и номеру, даже если у здания есть название', () => {
    const place = toPlace({
      ...base,
      name: 'Институт искусств',
      address: { road: 'улица Ленина', house_number: '22', city_district: 'Центральный район' },
    });
    expect(place).toEqual({
      label: 'улица Ленина, 22',
      context: 'Центральный район',
      lat: 56.0154,
      lng: 92.8897,
    });
  });

  it('парк или площадь — по названию, район — микрорайон, если есть', () => {
    expect(
      toPlace({
        ...base,
        name: 'Покровский парк',
        address: { suburb: 'Покровка', city_district: 'Центральный район' },
      }),
    ).toMatchObject({ label: 'Покровский парк', context: 'Покровка' });
  });

  it('без названия и улицы — первая часть полного адреса', () => {
    expect(toPlace({ ...base, display_name: '660049, Красноярск, Россия' }).label).toBe('660049');
  });
});

describe('uniquePlaces', () => {
  it('одно место с подписью в другом регистре рядом — один раз, далёкое — остаётся', () => {
    const island = { label: 'Остров Татышев', context: null, lat: 56.0289, lng: 92.9451 };
    const same = { ...island, label: 'остров Татышев', lat: 56.027, lng: 92.9402 };
    const far = { ...island, lat: 56.1, lng: 93.1 };
    expect(uniquePlaces([island, same, far])).toEqual([island, far]);
  });
});

/** Ответ fetch с JSON. */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const park: NominatimPlace = { lat: '56.0244', lon: '92.8617', name: 'Покровский парк' };

describe('createGeocoder', () => {
  it('ищет в Красноярске, на русском, с User-Agent приложения', async () => {
    const send = vi.fn(async () => json([park]));
    const geocoder = createGeocoder({ baseUrl: 'https://nominatim.test', fetch: send });

    const places = await geocoder.search('Покровский парк');

    expect(places).toEqual([
      { label: 'Покровский парк', context: null, lat: 56.0244, lng: 92.8617 },
    ]);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    const query = new URL(url).searchParams;
    expect(new URL(url).pathname).toBe('/search');
    expect(query.get('q')).toBe('Покровский парк');
    expect(query.get('bounded')).toBe('1');
    expect(query.get('viewbox')).toBe('92.55,56.15,93.25,55.9');
    expect(query.get('accept-language')).toBe('ru');
    expect((init.headers as Record<string, string>)['user-agent']).toMatch(
      /^vmeste-sport-platform/,
    );
  });

  it('не нашли — пробует адрес короче', async () => {
    const send = vi.fn(async (url: RequestInfo | URL) =>
      json(new URL(String(url)).searchParams.get('q') === 'улица Весны, 23' ? [park] : []),
    );
    const geocoder = createGeocoder({ baseUrl: 'https://n.test', fetch: send, minIntervalMs: 0 });

    const places = await geocoder.search('ул. Весны, 23, у фонтана');

    expect(places).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('нигде не нашли — пустой список', async () => {
    const geocoder = createGeocoder({
      baseUrl: 'https://n.test',
      fetch: async () => json([]),
      minIntervalMs: 0,
    });
    expect(await geocoder.search('Нет такого места')).toEqual([]);
  });

  it('повторный запрос берёт из кэша', async () => {
    const send = vi.fn(async () => json([park]));
    const geocoder = createGeocoder({ baseUrl: 'https://n.test', fetch: send, minIntervalMs: 0 });

    await geocoder.search('Покровский парк');
    await geocoder.search('Покровский парк');

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('запросы идут по одному, не чаще заданного интервала', async () => {
    const calls: number[] = [];
    const geocoder = createGeocoder({
      baseUrl: 'https://n.test',
      fetch: async () => {
        calls.push(Date.now());
        return json([park]);
      },
      minIntervalMs: 60,
    });

    await Promise.all([geocoder.search('Первый'), geocoder.search('Второй')]);

    expect(calls).toHaveLength(2);
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(55);
  });

  it('сервис ответил ошибкой или не отвечает — 503 GEOCODER_UNAVAILABLE', async () => {
    const failing = createGeocoder({
      baseUrl: 'https://n.test',
      fetch: async () => json({}, 502),
      minIntervalMs: 0,
    });
    await expect(failing.search('Покровский парк')).rejects.toMatchObject({
      status: 503,
      code: 'GEOCODER_UNAVAILABLE',
    });

    const offline = createGeocoder({
      baseUrl: 'https://n.test',
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
      minIntervalMs: 0,
    });
    await expect(offline.search('Покровский парк')).rejects.toMatchObject({ status: 503 });
  });

  it('выключенный поиск (тесты, пустой GEOCODER_URL) — 503 без запросов', async () => {
    const send = vi.fn();
    const geocoder = createGeocoder({ baseUrl: null, fetch: send });
    await expect(geocoder.search('Покровский парк')).rejects.toMatchObject({ status: 503 });
    expect(send).not.toHaveBeenCalled();
  });

  it('адрес по точке: подпись места и та же точка; пусто — null', async () => {
    const geocoder = createGeocoder({
      baseUrl: 'https://n.test',
      fetch: async (url) =>
        json(
          new URL(String(url)).searchParams.get('lat') === '56.01'
            ? {
                lat: '56.0101',
                lon: '92.8501',
                address: { road: 'улица Весны', house_number: '23' },
              }
            : { error: 'Unable to geocode' },
        ),
      minIntervalMs: 0,
    });

    expect(await geocoder.reverse(56.01, 92.85)).toEqual({
      label: 'улица Весны, 23',
      context: null,
      lat: 56.01,
      lng: 92.85,
    });
    expect(await geocoder.reverse(0, 0)).toBeNull();
  });
});
