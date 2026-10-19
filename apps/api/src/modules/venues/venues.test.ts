import { describe, expect, it } from 'vitest';
import { DomainError } from '../../lib/domain-error';
import { inBbox, parseBbox } from './geo';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  isSuitable,
  normalizeLimit,
  searchVenues,
  toVenueDto,
} from './search';
import type { VenueRecord } from './types';
import { VENUE_TYPE_LABELS, buildVenueTypesResponse } from './venue-types';

function venue(
  patch: Partial<VenueRecord> & Pick<VenueRecord, 'id' | 'name' | 'type'>,
): VenueRecord {
  return {
    address: 'ул. Ленина, 1',
    lat: 56.01,
    lng: 92.85,
    description: null,
    workingHours: null,
    contactName: null,
    contactPhone: null,
    contactNote: null,
    ...patch,
  };
}

const venues: VenueRecord[] = [
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

const ids = (list: { id: string }[]) => list.map((v) => v.id);

describe('parseBbox', () => {
  it('разбирает четыре числа', () => {
    expect(parseBbox('92.8,56.0,92.9,56.1')).toEqual({
      minLng: 92.8,
      minLat: 56.0,
      maxLng: 92.9,
      maxLat: 56.1,
    });
  });

  it('допускает пробелы вокруг чисел', () => {
    expect(parseBbox(' 92.8, 56.0, 92.9, 56.1 ').maxLat).toBe(56.1);
  });

  it.each([
    ['пустая строка', ''],
    ['три числа', '92.8,56.0,92.9'],
    ['пять чисел', '1,2,3,4,5'],
    ['не числа', 'a,b,c,d'],
    ['пустой элемент', '92.8,,92.9,56.1'],
    ['min больше max по долготе', '92.9,56.0,92.8,56.1'],
    ['min больше max по широте', '92.8,56.1,92.9,56.0'],
    ['широта вне диапазона', '92.8,56.0,92.9,91'],
    ['долгота вне диапазона', '-181,56.0,92.9,56.1'],
    ['Infinity', '92.8,56.0,Infinity,56.1'],
  ])('%s: 422 INVALID_BBOX', (_name, raw) => {
    try {
      parseBbox(raw);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect([(e as DomainError).status, (e as DomainError).code]).toEqual([422, 'INVALID_BBOX']);
      return;
    }
    throw new Error('Ожидалась ошибка INVALID_BBOX');
  });

  it('inBbox: границы включены', () => {
    const bbox = parseBbox('92.8,56.0,92.9,56.1');
    expect(inBbox({ lat: 56.0, lng: 92.8 }, bbox)).toBe(true);
    expect(inBbox({ lat: 56.1, lng: 92.9 }, bbox)).toBe(true);
    expect(inBbox({ lat: 56.11, lng: 92.85 }, bbox)).toBe(false);
  });
});

describe('searchVenues', () => {
  it('без параметров: все площадки по названию, без поля suitable', () => {
    const result = searchVenues(venues);
    expect(result).toHaveLength(5);
    expect(result.every((v) => !('suitable' in v))).toBe(true);
    const names = result.map((v) => v.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
  });

  it('фильтр по типам', () => {
    expect(ids(searchVenues(venues, { types: ['cafe', 'club'] })).sort()).toEqual(['v1', 'v2']);
  });

  it('пустой список типов не фильтрует', () => {
    expect(searchVenues(venues, { types: [] })).toHaveLength(5);
  });

  it('фильтр по области карты', () => {
    const bbox = parseBbox('92.84,56.00,92.86,56.015');
    expect(ids(searchVenues(venues, { bbox })).sort()).toEqual(['v1', 'v2', 'v4', 'v5']);
  });

  it('текстовый поиск по названию и адресу без учёта регистра', () => {
    expect(ids(searchVenues(venues, { q: 'ЭНДШПИЛЬ' }))).toEqual(['v2']);
    expect(ids(searchVenues(venues, { q: 'мира' }))).toEqual(['v1']);
    expect(searchVenues(venues, { q: 'нет такого' })).toEqual([]);
  });

  it('шахматы: подходящие первыми и помечены suitable', () => {
    const result = searchVenues(venues, { sportVenueTypes: ['cafe', 'club'] });
    expect(ids(result).slice(0, 2).sort()).toEqual(['v1', 'v2']);
    expect(result.slice(0, 2).every((v) => v.suitable === true)).toBe(true);
    expect(result.slice(2).every((v) => v.suitable === false)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('onlySuitable оставляет только подходящие', () => {
    const result = searchVenues(venues, { sportVenueTypes: ['field', 'hall'], onlySuitable: true });
    expect(ids(result).sort()).toEqual(['v3', 'v4']);
  });

  it('свой вид спорта без подсказки: подходят все площадки', () => {
    const result = searchVenues(venues, { sportVenueTypes: [], onlySuitable: true });
    expect(result).toHaveLength(5);
    expect(result.every((v) => v.suitable === true)).toBe(true);
  });

  it('onlySuitable без вида спорта игнорируется', () => {
    expect(searchVenues(venues, { onlySuitable: true })).toHaveLength(5);
  });

  it('фильтры комбинируются', () => {
    const result = searchVenues(venues, {
      sportVenueTypes: ['cafe', 'club'],
      onlySuitable: true,
      q: 'клуб',
    });
    expect(ids(result)).toEqual(['v2']);
  });

  it('лимит обрезает выдачу', () => {
    expect(searchVenues(venues, { limit: 2 })).toHaveLength(2);
  });
});

describe('normalizeLimit', () => {
  it('значения по умолчанию и границы', () => {
    expect(normalizeLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(normalizeLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(-5)).toBe(1);
    expect(normalizeLimit(10.9)).toBe(10);
    expect(normalizeLimit(100000)).toBe(MAX_LIMIT);
  });
});

describe('toVenueDto', () => {
  it('контакт собирается из заполненных полей', () => {
    const dto = toVenueDto(venues[0]!);
    expect(dto.contact).toEqual({ name: 'Ирина Соколова', phone: '+7 900 000-01-01', note: null });
  });

  it('парки и дворы без контактов: contact = null', () => {
    expect(toVenueDto(venues[4]!).contact).toBeNull();
  });

  it('suitable добавляется только когда передан', () => {
    expect(toVenueDto(venues[0]!)).not.toHaveProperty('suitable');
    expect(toVenueDto(venues[0]!, false).suitable).toBe(false);
  });
});

describe('isSuitable', () => {
  it('учитывает список типов; пустой список подходит всем', () => {
    expect(isSuitable('cafe', ['cafe', 'club'])).toBe(true);
    expect(isSuitable('park', ['cafe', 'club'])).toBe(false);
    expect(isSuitable('park', [])).toBe(true);
  });
});

describe('buildVenueTypesResponse', () => {
  it('отдаёт все типы с русскими подписями', () => {
    const { types } = buildVenueTypesResponse([]);
    expect(types).toHaveLength(8);
    expect(types.find((t) => t.value === 'cafe')?.label).toBe('Кафе');
    expect(types.every((t) => t.label === VENUE_TYPE_LABELS[t.value])).toBe(true);
  });

  it('группирует связки по виду спорта без дублей; у вида спорта без связок ключа нет', () => {
    const { bySport } = buildVenueTypesResponse([
      { sportId: 'chess', venueType: 'cafe' },
      { sportId: 'chess', venueType: 'club' },
      { sportId: 'chess', venueType: 'cafe' },
      { sportId: 'football', venueType: 'field' },
    ]);
    expect(bySport).toEqual({ chess: ['cafe', 'club'], football: ['field'] });
    expect(bySport).not.toHaveProperty('curling');
  });
});
