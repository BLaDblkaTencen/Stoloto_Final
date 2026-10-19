// Карта встреч (задача 2.10): события в видимой области, метки по виду спорта, попап с кнопкой.
// Ленивая часть EventsMap: всё, что требует Leaflet.
import { EVENT_TIMEZONE, type EventMapItem } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import type { Bbox, Venue } from '@sport/shared/schemas/venues';
import { useEffect, type ReactNode } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router';
import {
  ButtonLink,
  eventPin,
  JoinModeBadge,
  MapPopupCard,
  sportColor,
  VenueCard,
  venuePin,
} from '../../../shared/ui';
import { BaseMap, cachedIcon } from './BaseMap';
import { venueCardData } from './venueCardData';

export type EventsMapViewProps = {
  events: EventMapItem[];
  sportsById: Map<string, Sport>;
  /** Слой площадок с контактами; пустой — слой выключен. */
  venues?: Venue[];
  /** Ссылка «Создать встречу здесь» в попапе площадки; null — кнопки нет (гость, админ). */
  createHref?: ((venue: Venue) => string) | null;
  selectedId?: string;
  onBoundsChange: (bbox: Bbox) => void;
  className?: string;
};

// Время встречи по Красноярску, как в ленте и карточке, а не в поясе браузера.
const dateFormat = new Intl.DateTimeFormat('ru', {
  timeZone: EVENT_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function EventsMapView({
  events,
  sportsById,
  venues = [],
  createHref = null,
  selectedId,
  onBoundsChange,
  className,
}: EventsMapViewProps) {
  // С включёнными площадками встреча на площадке стоит ровно на её метке и закрыла бы её:
  // такие встречи показываем списком в попапе площадки, отдельной меткой — только свои точки.
  const atVenue = new Map<string, EventMapItem[]>(venues.map((venue) => [venue.id, []]));
  const ownPoints: EventMapItem[] = [];
  for (const event of events) {
    const list = event.venueId ? atVenue.get(event.venueId) : undefined;
    if (list) list.push(event);
    else ownPoints.push(event);
  }

  return (
    <BaseMap label="Карта встреч" className={className}>
      <BoundsWatcher onChange={onBoundsChange} />
      {venues.map((venue) => {
        const suitable = venue.suitable ?? true;
        const here = atVenue.get(venue.id) ?? [];
        // У площадки со встречами метка крупнее: видно, где уже собираются.
        const busy = here.length > 0;
        return (
          <Marker
            key={`venue:${venue.id}`}
            position={[venue.lat, venue.lng]}
            title={busy ? `${venue.name}: встреч ${here.length}` : venue.name}
            zIndexOffset={busy ? 500 : suitable ? 100 : 0}
            icon={cachedIcon(`venue:${venue.type}:${suitable}:${busy}`, () =>
              venuePin({ type: venue.type, suitable, selected: busy }),
            )}
          >
            {/* maxHeight: попап выше карты Leaflet сдвигает её при каждой перерисовке без конца. */}
            <Popup minWidth={300} maxWidth={320} maxHeight={380}>
              <div className="bg-surface text-ink">
                <VenueCard venue={venueCardData(venue)} compact />
                <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                  {here.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold">Встречи здесь</div>
                      {here.map((event) => (
                        <PopupLink key={event.id} to={`/events/${event.id}`}>
                          {event.title}
                          <span className="block text-sm text-ink-muted">
                            {dateFormat.format(new Date(event.startsAt))}
                          </span>
                        </PopupLink>
                      ))}
                    </div>
                  )}
                  {createHref && (
                    <PopupLink to={createHref(venue)} button>
                      Создать встречу здесь
                    </PopupLink>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {ownPoints.map((event) => {
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
        <PopupLink to={`/events/${event.id}`} button>
          Подробнее
        </PopupLink>
      }
    >
      <span>{dateFormat.format(new Date(event.startsAt))}</span>
      <span>{places}</span>
    </MapPopupCard>
  );
}

/**
 * Ссылка из попапа: сначала закрывает попап, потом переходит. Пока грузится ленивая страница,
 * карта ещё на экране и видит новый адрес (например, без ?venues=1); если её метка исчезнет
 * с открытым попапом, react-leaflet уходит в бесконечный цикл обновлений.
 */
function PopupLink({
  to,
  button = false,
  children,
}: {
  to: string;
  button?: boolean;
  children: ReactNode;
}) {
  const map = useMap();
  const close = () => map.closePopup();
  return button ? (
    <ButtonLink to={to} className="w-full" onClick={close}>
      {children}
    </ButtonLink>
  ) : (
    <Link to={to} className="leading-snug" onClick={close}>
      {children}
    </Link>
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
