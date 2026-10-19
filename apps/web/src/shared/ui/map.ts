// Метки карты в стиле «Вместе» для Leaflet. Leaflet ставит метку как HTML-строку (L.divIcon),
// а не как React-компонент, поэтому здесь функции, которые собирают строку и размеры:
//
//   import L from 'leaflet';
//   const icon = L.divIcon(eventPin({ sportSlug: e.sport.slug, joinMode: e.joinMode, selected }));
//   L.marker([e.lat, e.lng], { icon, title: e.title, keyboard: true }).addTo(map);
//
// В react-leaflet: <Marker position={…} icon={L.divIcon(eventPin(…))} title={e.title} />.
// title у маркера обязателен: это подпись метки для экранного диктора.
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

const SIZE = { normal: 46, selected: 60, muted: 36 } as const;

const svg = (icon: IconName, size: number, stroke: string, width: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[icon]}"/></svg>`;

type PinOptions = {
  icon: IconName;
  /** Цвет заливки: CSS-значение, например sportColor(slug). */
  color: string;
  selected?: boolean;
  /** Замок в углу: событие «по заявке». */
  locked?: boolean;
  /** Приглушённая метка: площадка не подходит выбранному виду спорта. */
  muted?: boolean;
};

/** Параметры для L.divIcon: html, размер и точка привязки (центр метки). */
export function pinIcon({
  icon,
  color,
  selected = false,
  locked = false,
  muted = false,
}: PinOptions) {
  const size = selected ? SIZE.selected : muted ? SIZE.muted : SIZE.normal;
  const classes = ['pin', selected && 'is-selected', muted && 'is-muted'].filter(Boolean).join(' ');
  const lock = locked ? `<span class="pin__lock">${svg('lock', 12, '#fff', 2.6)}</span>` : '';
  return {
    html: `<span class="${classes}" style="background:${muted ? 'var(--color-surface-muted)' : color}">${svg(icon, selected ? 28 : 22, 'currentColor', 2)}${lock}</span>`,
    // Пустой className убирает белый квадрат, который Leaflet рисует под divIcon по умолчанию.
    className: '',
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
    popupAnchor: [0, -size / 2] as [number, number],
  };
}

/** Метка события: цвет и иконка вида спорта, замок у режима «По заявке». */
export const eventPin = (o: { sportSlug: string; joinMode: JoinMode; selected?: boolean }) =>
  pinIcon({
    icon: sportIcon(o.sportSlug),
    color: sportColor(o.sportSlug),
    locked: o.joinMode === 'request',
    selected: o.selected,
  });

/** Метка площадки: иконка типа; подходящие виду спорта — яркие, остальные — приглушённые. */
export const venuePin = (o: { type: VenueType; suitable: boolean; selected?: boolean }) =>
  pinIcon({
    icon: venueTypeIcon(o.type),
    color: 'var(--color-accent)',
    muted: !o.suitable && !o.selected,
    selected: o.selected,
  });
