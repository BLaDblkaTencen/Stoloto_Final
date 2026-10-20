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

/** Ширина головки метки в пикселях на обзоре города. */
const SIZE = { normal: 46, selected: 60, muted: 36 } as const;
/** «Капля» — круг и острый конец снизу: высота ≈ 1,21 ширины (½ + √2⁄2). */
const DROP_HEIGHT = 0.5 + Math.SQRT1_2;

/**
 * Масштаб метки от масштаба карты: на обзоре города — полный размер, при приближении метка
 * уменьшается (до 0,6 на 17-м уровне), не закрывает соседние и точнее стоит на месте встречи.
 */
export function pinScale(zoom: number) {
  return Math.min(1, Math.max(0.6, 1 - (zoom - 13) * 0.1));
}

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
  ]
    .filter(Boolean)
    .join(' ');
  const lock = locked
    ? `<span class="pin__lock">${svg('lock', Math.round(12 * Math.max(scale, 0.75)), '#fff', 2.6)}</span>`
    : '';
  const fill = muted ? 'var(--color-surface-muted)' : color;
  // Над меткой: попап и подпись открываются от её верха, а не закрывают её.
  const above: [number, number] = [0, -height + 2];
  return {
    // --pin-size — ширина головки, --pin-k уменьшает замок вместе с меткой (map.css).
    html: `<span class="${classes}" style="--pin-color:${fill};--pin-size:${size}px;--pin-k:${scale}"><span class="pin__body"></span><span class="pin__icon">${svg(icon, Math.round((selected ? 28 : 22) * scale), 'currentColor', 2)}</span>${lock}</span>`,
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

/** Метка площадки: квадрат с иконкой типа; подходящие виду спорта — яркие, остальные — приглушённые. */
export const venuePin = (o: {
  type: VenueType;
  suitable: boolean;
  selected?: boolean;
  scale?: number;
}) =>
  pinIcon({
    icon: venueTypeIcon(o.type),
    color: 'var(--color-accent)',
    shape: 'badge',
    muted: !o.suitable && !o.selected,
    selected: o.selected,
    scale: o.scale,
  });

/**
 * Группа встреч, которые на этом масштабе налезли бы друг на друга: круг с числом, кольцо —
 * цвета видов спорта внутри (до шести). Чем больше встреч, тем крупнее круг.
 */
export function clusterPin({
  count,
  colors,
  scale = 1,
}: {
  count: number;
  /** CSS-цвета видов спорта в группе, например sportColor(slug). */
  colors: string[];
  scale?: number;
}) {
  const base = count < 5 ? 48 : count < 10 ? 54 : 60;
  const size = Math.round(base * Math.max(scale, 0.8));
  const ring = [...new Set(colors)].slice(0, 6);
  const step = 100 / Math.max(ring.length, 1);
  const gradient = ring.length
    ? `conic-gradient(${ring.map((color, i) => `${color} ${i * step}% ${(i + 1) * step}%`).join(', ')})`
    : 'var(--color-accent)';
  return {
    html: `<span class="map-cluster" style="--ring:${gradient}"><span class="map-cluster__count">${count}</span></span>`,
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
