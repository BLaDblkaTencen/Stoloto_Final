// Группы меток для карт зоны: метки, которые на этом масштабе налезают друг на друга, — одна
// метка с числом. Встречи группируются в круг, площадки — в квадрат. Владелец: участник 2.
// Ленивая часть карт: всё, что требует Leaflet.
import { groupNearby, type PointGroup } from '@sport/shared/mapClusters';
import L from 'leaflet';
import type { ReactNode } from 'react';
import { Marker, Tooltip, useMap } from 'react-leaflet';
import { PIN_SIZE } from '../../../shared/ui';
import { ariaLabel, useMapZoom } from './BaseMap';

/**
 * Ближе этого на экране (на обзоре города) метки и группы налезают друг на друга: группа
 * крупнее метки, поэтому радиус чуть больше ширины метки (PIN_SIZE).
 */
export const GROUP_RADIUS = Math.round(PIN_SIZE * 1.13);
/**
 * Головка «капли» выше её острого конца на ½ + √2⁄2 − ½ ширины (≈ 0,71 ширины). Группу встреч
 * рисуем там же, где их головки, а не ниже, у концов: иначе соседние капли налезают на неё.
 */
export const HEAD_OFFSET = PIN_SIZE * Math.SQRT1_2;
/** Ближе этого — «в одном месте»: приближать бесполезно, показываем списком. */
const SAME_PLACE_M = 40;
/** С этого масштаба группа не приближает, а показывает список: дальше дома и подъезды. */
const LIST_ZOOM = 17;

/** «1 встреча», «3 встречи», «12 встреч». */
export function countOf(n: number, [one, few, many]: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/**
 * Группы на текущем масштабе. Порядок входа задаёт группы, поэтому вход сортируем по id:
 * при перерисовке группы те же. position — точка группы на карте; dy поднимает её в пикселях.
 */
export function useScreenGroups<T extends { id: string }>(
  items: T[],
  at: (item: T) => [number, number],
  radius: number,
) {
  const map = useMap();
  const zoom = useMapZoom();
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const groups = groupNearby(
    sorted.map((item) => {
      const { x, y } = map.project(at(item), zoom);
      return { x, y, item };
    }),
    radius,
  );
  const position = (group: PointGroup<T>, dy = 0) => map.unproject([group.x, group.y - dy], zoom);
  return { groups, position, zoom };
}

/** Ключ группы для React: один и тот же состав — та же метка. */
export const groupKey = (prefix: string, group: PointGroup<{ id: string }>) =>
  `${prefix}:${group.items.map((item) => item.id).join('+')}`;

/**
 * Нажали на группу: карта приближается к ней. Если всё в одном месте или приближать уже
 * некуда — onSamePlace (список); без него приближаем до предела.
 */
export function expandGroup(map: L.Map, points: [number, number][], onSamePlace?: () => void) {
  const bounds = L.latLngBounds(points);
  const spread = map.distance(bounds.getSouthWest(), bounds.getNorthEast());
  if (onSamePlace && (spread < SAME_PLACE_M || map.getZoom() >= LIST_ZOOM)) onSamePlace();
  else {
    map.flyToBounds(bounds, {
      padding: [80, 80],
      maxZoom: onSamePlace ? LIST_ZOOM : map.getMaxZoom(),
      duration: 0.6,
    });
  }
}

/** Метка группы: подпись для диктора, подсказка при наведении, нажатие — onClick. */
export function GroupMarker({
  at,
  icon,
  label,
  onClick,
  children,
}: {
  at: L.LatLng;
  icon: L.DivIcon;
  label: string;
  onClick: () => void;
  /** Содержимое подсказки при наведении. */
  children: ReactNode;
}) {
  return (
    <Marker
      position={at}
      zIndexOffset={600}
      icon={icon}
      eventHandlers={{ add: ariaLabel(label), click: onClick }}
    >
      <Tooltip direction="top" className="map-tip" opacity={1}>
        {children}
        <span className="map-tip__muted">Нажмите, чтобы рассмотреть</span>
      </Tooltip>
    </Marker>
  );
}
