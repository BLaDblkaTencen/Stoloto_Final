import {
  createEventSchema,
  eventListQuerySchema,
  updateEventSchema,
} from '@sport/shared/schemas/events';
import { describe, expect, it } from 'vitest';

const valid = {
  title: 'Шахматы в кафе',
  description: 'Играем блиц, доски есть',
  sportId: '7f3c2c1e-5a4b-4c3d-9e2f-1a2b3c4d5e6f',
  startsAt: '2026-11-01T12:00:00.000Z',
  address: 'пр. Мира, 15',
  joinMode: 'free',
};

const fieldsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('форма создания события', () => {
  it('принимает минимальный набор и чистит пустые необязательные поля', () => {
    const result = createEventSchema.parse({ ...valid, requirements: '  ', chatUrl: '' });
    expect(result.startsAt).toBeInstanceOf(Date);
    expect(result.requirements).toBeNull();
    expect(result.chatUrl).toBeNull();
  });

  it('вид спорта: ровно один из списка или свой', () => {
    const { sportId: _, ...withoutSport } = valid;
    expect(fieldsOf(createEventSchema.safeParse(withoutSport))).toContain('sportId');
    expect(createEventSchema.safeParse({ ...withoutSport, sportName: 'Сквош' }).success).toBe(true);
    expect(fieldsOf(createEventSchema.safeParse({ ...valid, sportName: 'Сквош' }))).toContain(
      'sportId',
    );
  });

  it('адрес можно не писать, если выбрана площадка', () => {
    const { address: _, ...withoutAddress } = valid;
    expect(fieldsOf(createEventSchema.safeParse(withoutAddress))).toContain('address');
    expect(
      createEventSchema.safeParse({
        ...withoutAddress,
        venueId: '1f3c2c1e-5a4b-4c3d-9e2f-1a2b3c4d5e6f',
      }).success,
    ).toBe(true);
  });

  it('окончание позже начала, точка на карте — парой координат', () => {
    expect(
      fieldsOf(createEventSchema.safeParse({ ...valid, endsAt: '2026-11-01T11:00:00.000Z' })),
    ).toContain('endsAt');
    expect(fieldsOf(createEventSchema.safeParse({ ...valid, lat: 56 }))).toContain('lat');
    expect(createEventSchema.safeParse({ ...valid, lat: 56, lng: 92.9 }).success).toBe(true);
  });

  it('лимит мест и ссылка на чат', () => {
    expect(fieldsOf(createEventSchema.safeParse({ ...valid, capacity: 0 }))).toContain('capacity');
    expect(createEventSchema.safeParse({ ...valid, capacity: null }).success).toBe(true);
    expect(
      fieldsOf(createEventSchema.safeParse({ ...valid, chatUrl: 'javascript:alert(1)' })),
    ).toContain('chatUrl');
  });
});

describe('правка события', () => {
  it('все поля необязательны, уровень не сбрасывается на «любой»', () => {
    expect(updateEventSchema.parse({ title: 'Новое название' })).toEqual({
      title: 'Новое название',
    });
  });

  it('свой и списочный вид спорта одновременно — ошибка', () => {
    expect(
      fieldsOf(updateEventSchema.safeParse({ sportId: valid.sportId, sportName: 'Сквош' })),
    ).toContain('sportId');
  });
});

describe('фильтры ленты', () => {
  it('значения по умолчанию', () => {
    expect(eventListQuerySchema.parse({})).toMatchObject({
      includePast: false,
      view: 'list',
      limit: 20,
      offset: 0,
    });
  });

  it('один день раскрывается в диапазон, виды спорта — списком', () => {
    const query = eventListQuerySchema.parse({
      date: '2026-11-01',
      sportId: `${valid.sportId}, 1f3c2c1e-5a4b-4c3d-9e2f-1a2b3c4d5e6f`,
    });
    expect(query).toMatchObject({ dateFrom: '2026-11-01', dateTo: '2026-11-01' });
    expect(query.sportId).toHaveLength(2);
  });

  it('«Где»: обрезается по краям, длинный запрос — ошибка', () => {
    expect(eventListQuerySchema.parse({ place: '  Весны ' }).place).toBe('Весны');
    expect(eventListQuerySchema.safeParse({ place: 'а'.repeat(101) }).success).toBe(false);
  });

  it('область карты: четыре числа, min не больше max', () => {
    expect(eventListQuerySchema.parse({ bbox: '92.7,55.9,93.1,56.1' }).bbox).toEqual({
      minLng: 92.7,
      minLat: 55.9,
      maxLng: 93.1,
      maxLat: 56.1,
    });
    expect(eventListQuerySchema.safeParse({ bbox: '93,56,92,55' }).success).toBe(false);
    expect(eventListQuerySchema.safeParse({ bbox: '1,2,3' }).success).toBe(false);
  });

  it('в списке не больше 50, для карты — до 500', () => {
    expect(eventListQuerySchema.safeParse({ limit: '60' }).success).toBe(false);
    expect(eventListQuerySchema.parse({ view: 'map', limit: '300' }).limit).toBe(300);
  });
});
