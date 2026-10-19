// Карта выбора места (задача 2.9): площадки метками, своя точка — нажатием на свободное место.
// Ленивая часть MapPicker: всё, что требует Leaflet.
import type { Venue } from '@sport/shared/schemas/venues';
import { useEffect } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import { pinIcon, venuePin } from '../../../shared/ui';
import { BaseMap, cachedIcon } from './BaseMap';
import type { PlaceValue } from './MapPicker';

export type PickerMapProps = {
  venues: Venue[];
  value: PlaceValue;
  onPickVenue: (venue: Venue) => void;
  onPickPoint: (lat: number, lng: number) => void;
};

export function PickerMap({ venues, value, onPickVenue, onPickPoint }: PickerMapProps) {
  const selectedId = value?.kind === 'venue' ? value.venue.id : null;
  return (
    <BaseMap label="Карта для выбора места встречи" className="h-[420px] md:h-[520px]">
      <PointPicker onPick={onPickPoint} />
      <FollowSelection value={value} />
      {venues.map((venue) => {
        const selected = venue.id === selectedId;
        const suitable = venue.suitable ?? true;
        return (
          <Marker
            key={venue.id}
            position={[venue.lat, venue.lng]}
            title={venue.name}
            icon={cachedIcon(`venue:${venue.type}:${suitable}:${selected}`, () =>
              venuePin({ type: venue.type, suitable, selected }),
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
          icon={cachedIcon('point', () =>
            pinIcon({ icon: 'pin', color: 'var(--color-accent)', selected: true }),
          )}
        />
      )}
    </BaseMap>
  );
}

/** Нажатие на свободное место карты ставит свою точку (метки площадок нажатие не пропускают). */
function PointPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (event) => onPick(round(event.latlng.lat), round(event.latlng.lng)),
  });
  return null;
}

/** Выбор из списка под картой сдвигает карту к месту, чтобы его было видно. */
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
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    if (!map.getBounds().pad(-0.1).contains([lat, lng])) map.panTo([lat, lng]);
  }, [map, lat, lng]);
  return null;
}

// 6 знаков после запятой — около 10 см: точнее не нужно, а в адресе и базе короче.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default PickerMap;
