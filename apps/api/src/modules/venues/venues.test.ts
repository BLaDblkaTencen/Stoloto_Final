import { formatBbox, parseBbox, venuesQuery } from '@sport/shared/schemas/venues';
import { describe, expect, it } from 'vitest';
import {
  buildVenueTypes,
  isSuitable,
  searchVenues,
  sportTypesFor,
  toVenueCard,
  type VenueRow,
} from './search';

function venue(patch: Partial<VenueRow> & Pick<VenueRow, 'id' | 'name' | 'type'>): VenueRow {
  return {
    address: 'ул. Ленина, 1',
    lat: 56.01,
    lng: 92.85,
    description: null,
    workingHours: null,
    contactName: null,
    contactPhone: null,
    contactNote: null,
    createdAt: new Date(),
    ...patch,
  };
}

const rows: VenueRow[] = [
  venue({
    id: 'v1',
    name: 'Кафе «Ход конём»',
    type: 'cafe',
    address: 'пр. Мира, 12',
    lat: 56.0102,
    lng: 92.8512,
    contactName: 'Ирина Соколова',
    contactPhone: '+7 900 000-01-01',
  }),
  venue({ id: 'v2', name: 'Шахматный клуб «Эндшпиль»', type: 'club', lat: 56.0063, lng: 92.845 }),
  venue({ id: 'v3', name: 'Поле «Северное»', type: 'field', lat: 56.029, lng: 92.842 }),
  venue({ id: 'v4', name: 'Спортзал «Динамика»', type: 'hall', lat: 56.012, lng: 92.8575 }),
  venue({ id: 'v5', name: 'Центральный парк', type: 'park', lat: 56.0079, lng: 92.8531 }),
];

const ids = (list: { id: string }[]) => list.map((v) => v.id).sort();
const query = (raw: Record<string, string> = {}) => venuesQuery.parse(raw);

describe('parseBbox', () => {
  it('разбирает четыре числа, пробелы допустимы', () => {
    expect(parseBbox(' 92.8, 56.0, 92.9, 56.1 ')).toEqual({
      minLng: 92.8,
      minLat: 56,
      maxLng: 92.9,
      maxLat: 56.1,
    });
  });

  it.each([
    '',
    '92.8,56.0,92.9',
    '1,2,3,4,5',
    'a,b,c,d',
    '92.8,,92.9,56.1',
    '92.9,56.0,92.8,56.1',
    '92.8,56.1,92.9,56.0',
    '92.8,56.0,92.9,91',
    '-181,56.0,92.9,56.1',
    '92.8,56.0,Infinity,56.1',
  ])('неверная область «%s» → null', (raw) => {
    expect(parseBbox(raw)).toBeNull();
  });

  it('formatBbox и parseBbox обратимы', () => {
    const bbox = { minLng: 92.8, minLat: 56, maxLng: 92.9, maxLat: 56.1 };
    expect(parseBbox(formatBbox(bbox))).toEqual(bbox);
  });
});

describe('venuesQuery', () => {
  it('значения по умолчанию', () => {
    expect(query()).toEqual({ onlySuitable: false, limit: 200 });
  });

  it('типы через запятую без дублей', () => {
    expect(query({ type: 'cafe, club,cafe' }).type).toEqual(['cafe', 'club']);
  });

  it.each([
    ['неизвестный тип', { type: 'cafe,bar' }, 'type'],
    ['неверная область', { bbox: '1,2,3' }, 'bbox'],
    ['лимит больше 500', { limit: '501' }, 'limit'],
    ['вид спорта не UUID', { sportId: 'football' }, 'sportId'],
  ])('%s: ошибка поля %s', (_name, raw, field) => {
    const result = venuesQuery.safeParse(raw);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.path).toEqual([field]);
  });
});

describe('searchVenues', () => {
  it('без вида спорта: все, по названию, без поля suitable', () => {
    const result = searchVenues(rows, query());
    expect(result).toHaveLength(5);
    expect(result.every((v) => !('suitable' in v))).toBe(true);
    const names = result.map((v) => v.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('ru').compare));
  });

  it('фильтры: типы, область, текст по названию и адресу', () => {
    expect(ids(searchVenues(rows, query({ type: 'cafe,club' })))).toEqual(['v1', 'v2']);
    expect(ids(searchVenues(rows, query({ bbox: '92.84,56.00,92.86,56.015' })))).toEqual([
      'v1',
      'v2',
      'v4',
      'v5',
    ]);
    expect(ids(searchVenues(rows, query({ q: 'ЭНДШПИЛЬ' })))).toEqual(['v2']);
    expect(ids(searchVenues(rows, query({ q: 'мира' })))).toEqual(['v1']);
  });

  it('шахматы: подходящие первыми и помечены', () => {
    const result = searchVenues(rows, query(), ['cafe', 'club']);
    expect(ids(result.slice(0, 2))).toEqual(['v1', 'v2']);
    expect(result.map((v) => v.suitable)).toEqual([true, true, false, false, false]);
  });

  it('onlySuitable оставляет подходящие; без вида спорта не действует', () => {
    expect(ids(searchVenues(rows, query({ onlySuitable: 'true' }), ['field', 'hall']))).toEqual([
      'v3',
      'v4',
    ]);
    expect(searchVenues(rows, query({ onlySuitable: 'true' }))).toHaveLength(5);
  });

  it('свой вид спорта без подсказки: подходят все', () => {
    const result = searchVenues(rows, query({ onlySuitable: 'true' }), []);
    expect(result.every((v) => v.suitable === true)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('лимит обрезает выдачу', () => {
    expect(searchVenues(rows, query({ limit: '2' }))).toHaveLength(2);
  });
});

describe('карточка, подсказки, типы', () => {
  it('контакт собирается из заполненных полей, у парка контакта нет', () => {
    expect(toVenueCard(rows[0]!).contact).toEqual({
      name: 'Ирина Соколова',
      phone: '+7 900 000-01-01',
      note: null,
    });
    expect(toVenueCard(rows[4]!).contact).toBeNull();
    expect(toVenueCard(rows[0]!)).not.toHaveProperty('createdAt');
  });

  it('isSuitable и sportTypesFor', () => {
    expect(isSuitable('park', ['cafe'])).toBe(false);
    expect(isSuitable('park', [])).toBe(true);
    const links = [
      { sportId: 'chess', venueType: 'cafe' as const },
      { sportId: 'chess', venueType: 'club' as const },
    ];
    expect(sportTypesFor(links, 'chess')).toEqual(['cafe', 'club']);
    expect(sportTypesFor(links, 'curling')).toEqual([]);
    expect(sportTypesFor(links, undefined)).toBeUndefined();
  });

  it('типы площадок с подписями и группировка по виду спорта без дублей', () => {
    const result = buildVenueTypes([
      { sportId: 'chess', venueType: 'cafe' },
      { sportId: 'chess', venueType: 'cafe' },
      { sportId: 'football', venueType: 'field' },
    ]);
    expect(result.types).toHaveLength(8);
    expect(result.types.find((t) => t.value === 'cafe')?.label).toBe('Кафе');
    expect(result.bySport).toEqual({ chess: ['cafe'], football: ['field'] });
  });
});
