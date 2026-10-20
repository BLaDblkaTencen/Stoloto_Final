// Карта выбора места (задача 2.9): площадки метками, своя точка — нажатием на свободное место.
// Ленивая часть MapPicker: всё, что требует Leaflet.
//
// До публикации на карте уже стоит временная метка встречи — такая, какой её увидят все:
// цвет и иконка вида спорта, замок «по заявке»; пунктир — пока черновик. Над ней подпись:
// название встречи, площадка и адрес — тот же, что в поле «Адрес» (поставили метку на карте —
// адрес точки пишется туда сам). Свою точку можно перетащить.
import { VENUE_TYPE_LABELS, type JoinMode } from '@sport/shared';
import type { Venue } from '@sport/shared/schemas/venues';
import type L from 'leaflet';
import { useEffect } from 'react';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { clusterPin, eventPin, pinIcon, pinScale, venuePin } from '../../../shared/ui';
import { ariaLabel, BaseMap, cachedIcon, useMapZoom } from './BaseMap';
import {
  countOf,
  expandGroup,
  GROUP_RADIUS,
  GroupMarker,
  groupKey,
  useScreenGroups,
} from './groups';
import type { PlaceValue } from './MapPicker';

/** Что уже известно о встрече из формы: по этому рисуем её временную метку. */
export type PlaceDraft = {
  /** slug вида спорта; null — ещё не выбран, метка общая. */
  sportSlug: string | null;
  joinMode: JoinMode | '';
  title: string;
};

export type PickerMapProps = {
  venues: Venue[];
  value: PlaceValue;
  /** Адрес из поля формы: подпись под названием встречи над её меткой. */
  address: string;
  draft: PlaceDraft;
  onPickVenue: (venue: Venue) => void;
  onPickPoint: (lat: number, lng: number) => void;
};

export function PickerMap({
  venues,
  value,
  address,
  draft,
  onPickVenue,
  onPickPoint,
}: PickerMapProps) {
  return (
    <BaseMap label="Карта для выбора места встречи" className="h-[420px] md:h-[520px]">
      <PointPicker onPick={onPickPoint} />
      <FollowSelection value={value} />
      <PickerMarkers
        venues={venues}
        value={value}
        address={address}
        draft={draft}
        onPickVenue={onPickVenue}
        onPickPoint={onPickPoint}
      />
    </BaseMap>
  );
}

function PickerMarkers({
  venues,
  value,
  address,
  draft,
  onPickVenue,
  onPickPoint,
}: PickerMapProps) {
  const map = useMap();
  // Вблизи метки мельче: не закрывают соседние и точнее стоят на месте (pinScale).
  const scale = pinScale(useMapZoom());
  const venueId = value?.kind === 'venue' ? value.venue.id : null;
  // Выбранную площадку закрывает метка самой встречи; площадка — в карточке под картой.
  // Налезающие друг на друга площадки — группа: нажатие приближает, дальше выбираем площадку.
  const { groups, position } = useScreenGroups(
    venues.filter((venue) => venue.id !== venueId),
    (venue) => [venue.lat, venue.lng],
    GROUP_RADIUS * scale,
  );
  const at: [number, number] | null =
    value?.kind === 'venue'
      ? [value.venue.lat, value.venue.lng]
      : value?.kind === 'point'
        ? [value.lat, value.lng]
        : null;
  // Подпись над меткой: у площадки — её название и адрес, у своей точки — адрес из поля.
  const lines = [value?.kind === 'venue' ? value.venue.name : '', address.trim()].filter(
    (line, i, all) => line !== '' && all.indexOf(line) === i,
  );
  return (
    <>
      {groups.map((group) => {
        if (group.items.length > 1) {
          const count = group.items.length;
          const names = group.items.map((venue) => venue.name);
          const places = countOf(count, ['площадка', 'площадки', 'площадок']);
          return (
            <GroupMarker
              key={groupKey('venues', group)}
              at={position(group)}
              icon={cachedIcon(`venues:${count}:${scale}`, () =>
                clusterPin({ count, colors: ['var(--color-accent)'], shape: 'square', scale }),
              )}
              label={`${places} рядом: ${names.join(', ')}`}
              onClick={() =>
                expandGroup(
                  map,
                  group.items.map((venue) => [venue.lat, venue.lng]),
                )
              }
            >
              <span className="map-tip__title">{places} рядом</span>
              <span className="map-tip__muted">
                {names.slice(0, 3).join(', ')}
                {count > 3 && '…'}
              </span>
            </GroupMarker>
          );
        }
        const venue = group.items[0];
        const suitable = venue.suitable ?? true;
        return (
          <Marker
            key={venue.id}
            position={[venue.lat, venue.lng]}
            icon={cachedIcon(`venue:${venue.type}:${suitable}:false:${scale}`, () =>
              venuePin({ type: venue.type, suitable, scale }),
            )}
            zIndexOffset={suitable ? 100 : 0}
            eventHandlers={{
              add: ariaLabel(`Площадка: ${venue.name}`),
              click: () => onPickVenue(venue),
            }}
          >
            <Tooltip direction="top" className="map-tip" opacity={1}>
              <span className="map-tip__title">{venue.name}</span>
              <span className="map-tip__muted">
                {VENUE_TYPE_LABELS[venue.type]}
                {venue.suitable ? ', подходит' : ''} — нажмите, чтобы выбрать
              </span>
            </Tooltip>
          </Marker>
        );
      })}
      {at && (
        <DraftMarker
          at={at}
          draft={draft}
          lines={lines}
          scale={scale}
          // Метку на площадке не тащим: место задаёт площадка. Свою точку — можно.
          onMove={value?.kind === 'point' ? onPickPoint : undefined}
        />
      )}
    </>
  );
}

/** Длинное название или адрес в подписи над меткой обрезаем: целиком они в полях формы. */
const LABEL_MAX = 60;
const cut = (text: string) => (text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text);

/** Временная метка встречи: так её увидят на карте после публикации. */
function DraftMarker({
  at,
  draft,
  lines,
  scale,
  onMove,
}: {
  at: [number, number];
  draft: PlaceDraft;
  /** Строки под названием: площадка, адрес. */
  lines: string[];
  scale: number;
  onMove?: (lat: number, lng: number) => void;
}) {
  const slug = draft.sportSlug;
  const joinMode = draft.joinMode || 'free';
  const title = draft.title.trim() || 'Ваша встреча';
  return (
    <Marker
      position={at}
      draggable={Boolean(onMove)}
      autoPan
      zIndexOffset={1000}
      icon={cachedIcon(`draft:${slug ?? '-'}:${joinMode}:${scale}`, () =>
        slug
          ? eventPin({ sportSlug: slug, joinMode, draft: true, scale })
          : pinIcon({ icon: 'pin', color: 'var(--color-accent)', draft: true, scale }),
      )}
      eventHandlers={{
        add: ariaLabel(`Метка вашей встречи: ${title}`),
        dragend: (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          onMove?.(round(lat), round(lng));
        },
      }}
    >
      <Tooltip permanent direction="top" className="map-label" opacity={1}>
        <span className="map-tip__title">{cut(title)}</span>
        {lines.map((line) => (
          <span key={line} className="map-tip__muted">
            {cut(line)}
          </span>
        ))}
      </Tooltip>
    </Marker>
  );
}

/** Нажатие на свободное место карты ставит свою точку (метки площадок нажатие не пропускают). */
function PointPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onPick(round(event.latlng.lat), round(event.latlng.lng)),
  });
  return null;
}

/** Улица и дом различимы с этого масштаба: точка по адресу видна на своём месте. */
const FOUND_ZOOM = 16;

/**
 * Выбор из списка под картой сдвигает карту к месту, чтобы его было видно. Точку, найденную
 * по адресу, карта ещё и приближает: человек проверяет, туда ли она встала.
 */
function FollowSelection({ value }: { value: PlaceValue }) {
  const map = useMap();
  const target =
    value?.kind === 'venue'
      ? ([value.venue.lat, value.venue.lng] as const)
      : value?.kind === 'point'
        ? ([value.lat, value.lng] as const)
        : null;
  const lat = target?.[0];
  const lng = target?.[1];
  const found = value?.kind === 'point' ? value.found : undefined;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    if (found) map.flyTo([lat, lng], Math.max(map.getZoom(), FOUND_ZOOM), { duration: 0.6 });
    else if (!map.getBounds().pad(-0.1).contains([lat, lng])) map.panTo([lat, lng]);
  }, [map, lat, lng, found]);
  return null;
}

// 6 знаков после запятой — около 10 см: точнее не нужно, а в адресе и базе короче.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default PickerMap;
