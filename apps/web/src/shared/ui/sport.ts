// Цвет и иконка вида спорта: одни и те же в чипах ленты, карточках и метках на карте.
// Цвет — по хэшу slug из палитры --sport-1…8 (docs/design/README.md), поэтому вид спорта,
// который пользователь вписал сам, получает постоянный цвет без правок кода.
import type { IconName } from './Icon';

const PALETTE_SIZE = 8;

/** Номер цвета 1…8 для slug; одинаковый при каждом вызове. */
export function sportColorIndex(slug: string) {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return (hash % PALETTE_SIZE) + 1;
}

/** CSS-значение цвета, например для style={{ background: sportColor(slug) }}. */
export const sportColor = (slug: string) => `var(--sport-${sportColorIndex(slug)})`;

// Иконки стартового каталога (slug из сида). Свой вид спорта получает общую иконку.
const SPORT_ICONS: Record<string, IconName> = {
  футбол: 'ball',
  баскетбол: 'ball',
  волейбол: 'ball',
  'настольный теннис': 'ball',
  бег: 'run',
  шахматы: 'chess',
  йога: 'yoga',
  'зарядка во дворе': 'sun',
  плавание: 'wave',
  велоспорт: 'bike',
  скалолазание: 'mount',
};

export const sportIcon = (slug: string): IconName => SPORT_ICONS[slug] ?? 'activity';
