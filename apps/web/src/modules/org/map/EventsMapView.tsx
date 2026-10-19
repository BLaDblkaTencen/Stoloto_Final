// Карта встреч (задача 2.10): события в видимой области, метки по виду спорта, попап с кнопкой.
// Ленивая часть EventsMap: всё, что требует Leaflet.
import type { EventMapItem } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import type { Bbox } from '@sport/shared/schemas/venues';
import { useEffect } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { ButtonLink, eventPin, JoinModeBadge, MapPopupCard, sportColor } from '../../../shared/ui';
import { BaseMap, cachedIcon } from './BaseMap';

export type EventsMapViewProps = {
  events: EventMapItem[];
  sportsById: Map<string, Sport>;
  selectedId?: string;
  onBoundsChange: (bbox: Bbox) => void;
  className?: string;
};

const dateFormat = new Intl.DateTimeFormat('ru', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function EventsMapView({
  events,
  sportsById,
  selectedId,
  onBoundsChange,
  className,
}: EventsMapViewProps) {
  return (
    <BaseMap label="Карта встреч" className={className}>
      <BoundsWatcher onChange={onBoundsChange} />
      {events.map((event) => {
        if (event.lat === null || event.lng === null) return null;
        const sport = sportsById.get(event.sportId);
        const slug = sport?.slug ?? '';
        const selected = event.id === selectedId;
        return (
          <Marker
            key={event.id}
            position={[event.lat, event.lng]}
            title={event.title}
            zIndexOffset={selected ? 1000 : 0}
            icon={cachedIcon(`event:${slug}:${event.joinMode}:${selected}`, () =>
              eventPin({ sportSlug: slug, joinMode: event.joinMode, selected }),
            )}
          >
            <Popup minWidth={300} maxWidth={300}>
              <EventPopup event={event} sport={sport} />
            </Popup>
          </Marker>
        );
      })}
    </BaseMap>
  );
}

function EventPopup({ event, sport }: { event: EventMapItem; sport: Sport | undefined }) {
  const places =
    event.capacity === null
      ? `Участников: ${event.participantsCount}`
      : `Участников: ${event.participantsCount} из ${event.capacity}`;
  return (
    <MapPopupCard
      color={sportColor(sport?.slug ?? '')}
      sport={sport?.name ?? 'Спорт'}
      badge={<JoinModeBadge mode={event.joinMode} />}
      title={event.title}
      actions={
        <ButtonLink to={`/events/${event.id}`} variant="primary">
          Подробнее
        </ButtonLink>
      }
    >
      <span>{dateFormat.format(new Date(event.startsAt))}</span>
      <span>{places}</span>
    </MapPopupCard>
  );
}

/** Сообщает видимую область при открытии карты и после каждого сдвига или масштабирования. */
function BoundsWatcher({ onChange }: { onChange: (bbox: Bbox) => void }) {
  const map = useMap();
  const report = () => {
    const b = map.getBounds();
    onChange({
      minLng: b.getWest(),
      minLat: b.getSouth(),
      maxLng: b.getEast(),
      maxLat: b.getNorth(),
    });
  };
  useMapEvents({ moveend: report });
  // Первая область — сразу после появления карты; дальше её сообщает moveend.
  useEffect(report, []);
  return null;
}

export default EventsMapView;
