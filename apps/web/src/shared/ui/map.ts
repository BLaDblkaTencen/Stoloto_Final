// Метки карты в стиле «Вместе» для Leaflet. Leaflet ставит метку как HTML-строку (L.divIcon),
// а не как React-компонент, поэтому здесь функции, которые собирают строку и размеры:
//
//   import L from 'leaflet';
//   const icon = L.divIcon(eventPin({ sportSlug: e.sport.slug, joinMode: e.joinMode, selected }));
//   L.marker([e.lat, e.lng], { icon, keyboard: true }).addTo(map);
//
// Формы говорят, что это: встреча — «капля», её острый конец стоит ровно в месте встречи;
// площадка — скруглённый квадрат по центру места; группа встреч — круг с числом (clusterPin).
// Подпись для экранного диктора — aria-label на метке (в react-leaflet её ставит карта
// участника 2): title дал бы браузерную подсказку поверх нашей.
// Стили .pin и оформление карты — в map.css; контейнер карты — с классом map-frame.
import type { JoinMode, VenueType } from '@sport/shared';
import { ICON_PATHS, type IconName } from './Icon';
import { sportColor, sportIcon } from './sport';

const VENUE_ICONS: Record<VenueType, IconName> = {
  cafe: 'cup',
  club: 'house',
  field: 'field',
  hall: 'dumbbell',
  pool: 'waves',
  park: 'tree',
  yard: 'yard',
  other: 'dot',
};

export const venueTypeIcon = (type: VenueType): IconName => VENUE_ICONS[type];

/** Ширина головки метки в пикселях на обзоре города (на 15% меньше макета: 46 → 39). */
const SIZE = { normal: 39, selected: 51, muted: 31 } as const;
/** Ширина обычной метки: от неё карта считает, какие метки налезают друг на друга. */
export const PIN_SIZE = SIZE.normal;
/** «Капля» — круг и острый конец снизу: высота ≈ 1,21 ширины (½ + √2⁄2). */
const DROP_HEIGHT = 0.5 + Math.SQRT1_2;

/** Уровень карты, на котором метка полного размера: обзор города. */
const FULL_ZOOM = 13;

/**
 * Масштаб метки от масштаба карты: полный размер — на обзоре города (13-й уровень).
 * При отдалении метка уменьшается на 15% за уровень, не мельче половины (на 10-м уровне 21 px:
 * весь город — цветные точки, а не крупные значки). При приближении — на 10% за уровень, до 0,6
 * с 17-го: не закрывает соседние и дома вокруг и точнее стоит на месте встречи.
 */
export function pinScale(zoom: number) {
  if (zoom < FULL_ZOOM) return Math.max(0.5, 1 - (FULL_ZOOM - zoom) * 0.15);
  return Math.max(0.6, 1 - (zoom - FULL_ZOOM) * 0.1);
}

/** Замок «По заявке» уменьшается вместе с меткой, но не мельче этой доли: режим должен читаться. */
const LOCK_MIN_SCALE = 0.6;

const svg = (icon: IconName, size: number, stroke: string, width: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[icon]}"/></svg>`;

type PinOptions = {
  icon: IconName;
  /** Цвет заливки: CSS-значение, например sportColor(slug). */
  color: string;
  /** drop — встреча (острый конец в точке), badge — площадка (квадрат по центру точки). */
  shape?: 'drop' | 'badge';
  selected?: boolean;
  /** Замок в углу: событие «по заявке». */
  locked?: boolean;
  /** Приглушённая метка: площадка не подходит выбранному виду спорта. */
  muted?: boolean;
  /** Черновик: встреча ещё не опубликована (форма) — пунктирная обводка. */
  draft?: boolean;
  /** Здесь уже есть встречи (площадка): обводка, но без увеличения — соседей не закрывает. */
  busy?: boolean;
  /** Множитель размера, обычно pinScale(map.getZoom()). */
  scale?: number;
};

/** Параметры для L.divIcon: html, размер и точка привязки (конец «капли» или центр квадрата). */
export function pinIcon({
  icon,
  color,
  shape = 'drop',
  selected = false,
  locked = false,
  muted = false,
  draft = false,
  busy = false,
  scale = 1,
}: PinOptions) {
  const size = Math.round((selected ? SIZE.selected : muted ? SIZE.muted : SIZE.normal) * scale);
  const height = shape === 'drop' ? Math.round(size * DROP_HEIGHT) : size;
  const classes = [
    'pin',
    `pin--${shape}`,
    selected && 'is-selected',
    muted && 'is-muted',
    draft && 'is-draft',
    busy && 'is-busy',
  ]
    .filter(Boolean)
    .join(' ');
  const lock = locked
    ? `<span class="pin__lock">${svg('lock', Math.round(10 * Math.max(scale, LOCK_MIN_SCALE)), '#fff', 2.6)}</span>`
    : '';
  const fill = muted ? 'var(--color-surface-muted)' : color;
  // Над меткой: попап и подпись открываются от её верха, а не закрывают её.
  const above: [number, number] = [0, -height + 2];
  return {
    // --pin-size — ширина головки, --pin-k уменьшает замок вместе с меткой (map.css).
    html: `<span class="${classes}" style="--pin-color:${fill};--pin-size:${size}px;--pin-k:${scale}"><span class="pin__body"></span><span class="pin__icon">${svg(icon, Math.round((selected ? 24 : 19) * scale), 'currentColor', 2)}</span>${lock}</span>`,
    // Пустой className убирает белый квадрат, который Leaflet рисует под divIcon по умолчанию.
    className: '',
    iconSize: [size, height] as [number, number],
    iconAnchor: (shape === 'drop' ? [size / 2, height] : [size / 2, size / 2]) as [number, number],
    popupAnchor: shape === 'drop' ? above : ([0, -size / 2] as [number, number]),
    tooltipAnchor: shape === 'drop' ? above : ([0, -size / 2] as [number, number]),
  };
}

/** Метка события: «капля» в цвете вида спорта с его иконкой, замок у режима «По заявке». */
export const eventPin = (o: {
  sportSlug: string;
  joinMode: JoinMode;
  selected?: boolean;
  draft?: boolean;
  scale?: number;
}) =>
  pinIcon({
    icon: sportIcon(o.sportSlug),
    color: sportColor(o.sportSlug),
    locked: o.joinMode === 'request',
    selected: o.selected,
    draft: o.draft,
    scale: o.scale,
  });

/**
 * Метка площадки: квадрат с иконкой типа; подходящие виду спорта — яркие, остальные —
 * приглушённые; где уже есть встречи — с обводкой (busy).
 */
export const venuePin = (o: {
  type: VenueType;
  suitable: boolean;
  selected?: boolean;
  busy?: boolean;
  scale?: number;
}) =>
  pinIcon({
    icon: venueTypeIcon(o.type),
    color: 'var(--color-accent)',
    shape: 'badge',
    muted: !o.suitable && !o.selected && !o.busy,
    selected: o.selected,
    busy: o.busy,
    scale: o.scale,
  });

/**
 * Наименьшая группа по числу цифр. Число — Rubik 16px (≈ 11 px на цифру, высота 12 px), внутри
 * круга — кольцо и две обводки (16 px), и число должно поместиться в белый круг с запасом,
 * а не касаться его обводки.
 */
const CLUSTER_MIN = [34, 42, 50] as const;
/** Самая маленькая группа: ближе этого на экране метки и группы налезают друг на друга. */
export const CLUSTER_MIN_SIZE = CLUSTER_MIN[0];

/**
 * Группа меток, которые на этом масштабе налезли бы друг на друга: встречи — круг с числом,
 * кольцо — цвета видов спорта внутри (до шести); площадки — жёлтый квадрат с числом.
 * Чем больше меток, тем крупнее группа; с отдалением она уменьшается вместе с метками,
 * но не мельче, чем нужно числу (CLUSTER_MIN).
 */
export function clusterPin({
  count,
  colors,
  shape = 'circle',
  scale = 1,
}: {
  count: number;
  /** CSS-цвета видов спорта в группе, например sportColor(slug). */
  colors: string[];
  /** circle — встречи, square — площадки (как их метки). */
  shape?: 'circle' | 'square';
  scale?: number;
}) {
  const base = count < 5 ? 41 : count < 10 ? 46 : 51;
  const digits = Math.min(String(count).length, CLUSTER_MIN.length);
  const size = Math.max(Math.round(base * scale), CLUSTER_MIN[digits - 1]);
  const ring = [...new Set(colors)].slice(0, 6);
  const step = 100 / Math.max(ring.length, 1);
  const gradient = ring.length
    ? `conic-gradient(${ring.map((color, i) => `${color} ${i * step}% ${(i + 1) * step}%`).join(', ')})`
    : 'var(--color-accent)';
  return {
    html: `<span class="map-cluster map-cluster--${shape}" style="--ring:${gradient}"><span class="map-cluster__count">${count}</span></span>`,
    className: '',
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
    tooltipAnchor: [0, -size / 2] as [number, number],
    popupAnchor: [0, -size / 2] as [number, number],
  };
}

/** «Вы здесь» после кнопки «Где я»: точка с расходящимся кольцом. */
export const mePin = () => ({
  html: '<span class="map-me"></span>',
  className: '',
  iconSize: [22, 22] as [number, number],
  iconAnchor: [11, 11] as [number, number],
});
