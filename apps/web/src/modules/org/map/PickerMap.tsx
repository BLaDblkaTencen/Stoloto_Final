// Карта выбора места (задача 2.9): площадки метками, своя точка — нажатием на свободное место.
// Ленивая часть MapPicker: всё, что требует Leaflet.
import type { Venue } from '@sport/shared/schemas/venues';
import { useEffect, useState } from 'react';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { pinIcon, venuePin } from '../../../shared/ui';
import { BaseMap, cachedIcon, PinScaleWatcher } from './BaseMap';
import type { PlaceValue } from './MapPicker';

export type PickerMapProps = {
  venues: Venue[];
  value: PlaceValue;
  /** Адрес из поля формы: подпись над своей точкой, чтобы было видно, что вписано и где оно. */
  address: string;
  onPickVenue: (venue: Venue) => void;
  onPickPoint: (lat: number, lng: number) => void;
};

export function PickerMap({ venues, value, address, onPickVenue, onPickPoint }: PickerMapProps) {
  const label = address.trim();
  const selectedId = value?.kind === 'venue' ? value.venue.id : null;
  const [scale, setScale] = useState(1);
  return (
    <BaseMap label="Карта для выбора места встречи" className="h-[420px] md:h-[520px]">
      <PointPicker onPick={onPickPoint} />
      <PinScaleWatcher onChange={setScale} />
      <FollowSelection value={value} />
      {venues.map((venue) => {
        const selected = venue.id === selectedId;
        const suitable = venue.suitable ?? true;
        return (
          <Marker
            key={venue.id}
            position={[venue.lat, venue.lng]}
            title={venue.name}
            icon={cachedIcon(`venue:${venue.type}:${suitable}:${selected}:${scale}`, () =>
              venuePin({ type: venue.type, suitable, selected, scale }),
            )}
            zIndexOffset={selected ? 1000 : suitable ? 100 : 0}
            eventHandlers={{ click: () => onPickVenue(venue) }}
          />
        );
      })}
      {value?.kind === 'point' && (
        <Marker
          position={[value.lat, value.lng]}
          title="Своя точка встречи"
          zIndexOffset={1000}
          icon={cachedIcon(`point:${scale}`, () =>
            pinIcon({ icon: 'pin', color: 'var(--color-accent)', selected: true, scale }),
          )}
        >
          {label && (
            <Tooltip permanent direction="top" className="map-label">
              {label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label}
            </Tooltip>
          )}
        </Marker>
      )}
    </BaseMap>
  );
}

/** Длинный адрес в подписи над точкой обрезаем: целиком он виден в поле формы. */
const LABEL_MAX = 80;

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
