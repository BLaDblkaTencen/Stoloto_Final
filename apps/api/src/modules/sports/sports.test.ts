import {
  normalizeSportName,
  sportNameSchema,
  sportSlug,
  sportsQuerySchema,
} from '@sport/shared/schemas/sports';
import { describe, expect, it } from 'vitest';

describe('свой вид спорта', () => {
  it('название приводится к виду для показа', () => {
    expect(normalizeSportName('  йога   на сапах ')).toBe('Йога на сапах');
    expect(normalizeSportName('Футбол')).toBe('Футбол');
  });

  it('разные написания одного вида дают один ключ', () => {
    const key = sportSlug('Кик-боксинг');
    expect(sportSlug('кик  боксинг!')).toBe(key);
    expect(sportSlug(' КИК_БОКСИНГ ')).toBe(key);
    expect(key).toBe('кик боксинг');
  });

  it('ё и е не различаются', () => {
    expect(sportSlug('Зарядка во дворе (ёлки)')).toBe('зарядка во дворе елки');
  });

  it('ключи стартового списка совпадают с сидом: «Зарядка во дворе» не задвоится', () => {
    // Сид кладёт slug = name.toLowerCase() с заменой ё → е.
    for (const name of ['Футбол', 'Зарядка во дворе', 'Настольный теннис']) {
      expect(sportSlug(name)).toBe(name.toLowerCase().replaceAll('ё', 'е'));
    }
  });

  it('проверка ввода: длина и буквы', () => {
    expect(sportNameSchema.safeParse('Сквош').success).toBe(true);
    expect(sportNameSchema.safeParse(' а ').success).toBe(false);
    expect(sportNameSchema.safeParse('!!!').success).toBe(false);
    expect(sportNameSchema.safeParse('х'.repeat(41)).success).toBe(false);
  });
});

describe('популярные виды спорта для главной', () => {
  it('top — целое число от 1 до 20, из строки адреса', () => {
    expect(sportsQuerySchema.parse({ top: '6' })).toEqual({ top: 6 });
    expect(sportsQuerySchema.safeParse({ top: '0' }).success).toBe(false);
    expect(sportsQuerySchema.safeParse({ top: '21' }).success).toBe(false);
    expect(sportsQuerySchema.safeParse({ top: 'шесть' }).success).toBe(false);
  });
});
