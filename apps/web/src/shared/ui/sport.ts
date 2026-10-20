// Цвет и иконка вида спорта: одни и те же в чипах ленты, карточках и метках на карте.
// Цвет — по хэшу slug из палитры --sport-1…8 (docs/design/README.md), поэтому вид спорта,
// который пользователь вписал сам, получает постоянный цвет без правок кода.
import { sportTheme, type SportTheme } from '@sport/shared/sportThemes';
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

// Иконки стартового каталога (slug из сида). Свой вид спорта — по теме названия (THEME_ICONS),
// а если тему не узнали — общая иконка.
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

/** Иконка темы своего вида спорта: «Шашки» — фигура, «Верховая езда» — лошадь. */
const THEME_ICONS: Record<SportTheme, IconName> = {
  pingPong: 'pingPong',
  tennis: 'tennis',
  rugby: 'rugby',
  baseball: 'baseball',
  chess: 'chess',
  dice: 'dice',
  gamepad: 'gamepad',
  fight: 'fight',
  fencing: 'fencing',
  target: 'target',
  bowling: 'bowling',
  golf: 'golf',
  snow: 'snow',
  iceSkate: 'iceSkate',
  skate: 'skate',
  horse: 'horse',
  bike: 'bike',
  yoga: 'yoga',
  kayak: 'kayak',
  sail: 'sail',
  wave: 'wave',
  fish: 'fish',
  parachute: 'parachute',
  ball: 'ball',
  mount: 'mount',
  hike: 'hike',
  walk: 'walk',
  run: 'run',
  music: 'music',
  sun: 'sun',
  stretch: 'stretch',
  dumbbell: 'dumbbell',
};

/** Иконка по теме названия, без стартового каталога: подсказка в форме своего вида спорта. */
export function sportThemeIcon(slug: string): IconName | null {
  const theme = sportTheme(slug);
  return theme ? THEME_ICONS[theme] : null;
}

export const sportIcon = (slug: string): IconName =>
  SPORT_ICONS[slug] ?? sportThemeIcon(slug) ?? 'activity';
