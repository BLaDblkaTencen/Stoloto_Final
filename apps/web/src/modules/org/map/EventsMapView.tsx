// Карта встреч (задача 2.10): события в видимой области, метки по виду спорта, попап с кнопкой.
// Ленивая часть EventsMap: всё, что требует Leaflet.
//
// Метки «умные»: встречи, которые на этом масштабе налезли бы друг на друга, собираются в группу
// с числом и кольцом из цветов их видов спорта. Нажатие на группу приближает карту к ней,
// а если встречи в одном месте — показывает их списком. Наведение — название и время встречи.
import { EVENT_TIMEZONE, type EventMapItem } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import type { Bbox, Venue } from '@sport/shared/schemas/venues';
import { groupNearby, type PointGroup } from '@sport/shared/mapClusters';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router';
import {
  ButtonLink,
  clusterPin,
  eventPin,
  JoinModeBadge,
  MapPopupCard,
  pinScale,
  sportColor,
  VenueCard,
  venuePin,
} from '../../../shared/ui';
import { ariaLabel, BaseMap, cachedIcon, useMapZoom } from './BaseMap';
import { venueCardData } from './venueCardData';

export type EventsMapViewProps = {
  events: EventMapItem[];
  sportsById: Map<string, Sport>;
  /** Слой площадок с контактами; пустой — слой выключен. */
  venues?: Venue[];
  /** Ссылка «Создать встречу здесь» в попапе площадки; null — кнопки нет (гость, админ). */
  createHref?: ((venue: Venue) => string) | null;
  selectedId?: string;
  /** Нажали на метку встречи: список рядом выделяет ту же встречу. */
  onSelect?: (id: string) => void;
  /** Показать встречу: карта переходит к ней и открывает попап (кнопка «На карте» в списке). */
  focus?: MapFocus;
  onBoundsChange: (bbox: Bbox) => void;
  className?: string;
};

/** key меняется при каждом нажатии «На карте», чтобы повторное нажатие снова открыло попап. */
export type MapFocus = { id: string; lat: number; lng: number; key: number };

// Время встречи по Красноярску, как в ленте и карточке, а не в поясе браузера.
const dateFormat = new Intl.DateTimeFormat('ru', {
  timeZone: EVENT_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const when = (event: EventMapItem) => dateFormat.format(new Date(event.startsAt));

/** «1 встреча», «3 встречи», «12 встреч». */
function meetings(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} встреча`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} встречи`;
  return `${n} встреч`;
}

export function EventsMapView({
  events,
  sportsById,
  venues = [],
  createHref = null,
  selectedId,
  onSelect,
  focus,
  onBoundsChange,
  className,
}: EventsMapViewProps) {
  const markers = useRef(new Map<string, L.Marker>());
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
      <FocusWatcher focus={focus} markers={markers.current} events={events} />
      <VenueMarkers venues={venues} atVenue={atVenue} createHref={createHref} />
      <EventMarkers
        events={ownPoints}
        sportsById={sportsById}
        selectedId={selectedId}
        onSelect={onSelect}
        markers={markers.current}
      />
    </BaseMap>
  );
}

function VenueMarkers({
  venues,
  atVenue,
  createHref,
}: {
  venues: Venue[];
  atVenue: Map<string, EventMapItem[]>;
  createHref: ((venue: Venue) => string) | null;
}) {
  // Вблизи метки мельче: не закрывают соседние и точнее стоят на месте (pinScale).
  const scale = pinScale(useMapZoom());
  return venues.map((venue) => {
    const suitable = venue.suitable ?? true;
    const here = atVenue.get(venue.id) ?? [];
    // У площадки со встречами метка крупнее: видно, где уже собираются.
    const busy = here.length > 0;
    const label = busy ? `${venue.name}: ${meetings(here.length)}` : venue.name;
    return (
      <Marker
        key={`venue:${venue.id}`}
        position={[venue.lat, venue.lng]}
        zIndexOffset={busy ? 500 : suitable ? 100 : 0}
        eventHandlers={{ add: ariaLabel(label) }}
        icon={cachedIcon(`venue:${venue.type}:${suitable}:${busy}:${scale}`, () =>
          venuePin({ type: venue.type, suitable, selected: busy, scale }),
        )}
      >
        <Tooltip direction="top" className="map-tip" opacity={1}>
          <span className="map-tip__title">{venue.name}</span>
          {busy && <span className="map-tip__muted">Здесь {meetings(here.length)}</span>}
        </Tooltip>
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
                      <span className="block text-sm text-ink-muted">{when(event)}</span>
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
  });
}

/**
 * Ближе этого на экране (на обзоре города) метки и группы налезают друг на друга: группа (48–60px)
 * крупнее метки (46px), поэтому радиус чуть больше ширины метки.
 */
const GROUP_RADIUS = 52;
/**
 * Головка «капли» выше её острого конца на ½ + √2⁄2 − ½ ширины ≈ 32px. Группу рисуем там же,
 * где головки её встреч, а не ниже, у их концов: иначе соседние капли налезают на неё сверху.
 */
const HEAD_OFFSET = 46 * Math.SQRT1_2;
/** Встречи ближе этого — «в одном месте»: приближать бесполезно, показываем списком. */
const SAME_PLACE_M = 40;
/** С этого масштаба группа не приближает, а показывает список: дальше дома и подъезды. */
const LIST_ZOOM = 17;

type Placed = EventMapItem & { lat: number; lng: number };
const placed = (event: EventMapItem): event is Placed => event.lat !== null && event.lng !== null;

/**
 * Метки встреч с группировкой. Выбранная встреча в группы не попадает: «На карте» в ленте и
 * нажатие на метку должны показать именно её. Все метки — в одном массиве с ключом по id:
 * когда встреча становится выбранной, React двигает её метку, а не пересоздаёт (иначе её
 * открытый попап закрылся бы, а исчезнувшая с открытым попапом метка зацикливает react-leaflet).
 */
function EventMarkers({
  events,
  sportsById,
  selectedId,
  onSelect,
  markers,
}: {
  events: EventMapItem[];
  sportsById: Map<string, Sport>;
  selectedId?: string;
  onSelect?: (id: string) => void;
  markers: Map<string, L.Marker>;
}) {
  const map = useMap();
  const zoom = useMapZoom();
  const scale = pinScale(zoom);
  const [list, setList] = useState<{ key: string; at: L.LatLng; items: Placed[] } | null>(null);
  // Другой масштаб — другие группы: список старой группы закрываем.
  useEffect(() => setList(null), [zoom]);

  const visible = useMemo(
    () => events.filter(placed).sort((a, b) => a.id.localeCompare(b.id)),
    [events],
  );
  const groups = useMemo(() => {
    const points = visible
      .filter((event) => event.id !== selectedId)
      .map((event) => {
        const { x, y } = map.project([event.lat, event.lng], zoom);
        return { x, y, item: event };
      });
    return groupNearby(points, GROUP_RADIUS * scale);
  }, [visible, selectedId, map, zoom, scale]);
  const selected = visible.find((event) => event.id === selectedId);
  const headAt = (group: PointGroup<Placed>) =>
    map.unproject([group.x, group.y - HEAD_OFFSET * scale], zoom);

  const single = (event: Placed, isSelected: boolean) => (
    <EventMarker
      key={event.id}
      event={event}
      sport={sportsById.get(event.sportId)}
      selected={isSelected}
      scale={scale}
      onSelect={onSelect}
      markers={markers}
    />
  );

  const open = (group: PointGroup<Placed>, key: string) => {
    const bounds = L.latLngBounds(group.items.map((event) => [event.lat, event.lng]));
    const spread = map.distance(bounds.getSouthWest(), bounds.getNorthEast());
    if (spread < SAME_PLACE_M || map.getZoom() >= LIST_ZOOM) {
      setList({ key, at: headAt(group), items: group.items });
    } else {
      map.flyToBounds(bounds, { padding: [80, 80], maxZoom: LIST_ZOOM, duration: 0.6 });
    }
  };

  const nodes = groups.map((group) => {
    if (group.items.length === 1) return single(group.items[0], false);
    const key = `group:${group.items.map((event) => event.id).join('+')}`;
    return (
      <GroupMarker
        key={key}
        group={group}
        at={headAt(group)}
        sportsById={sportsById}
        scale={scale}
        onOpen={() => open(group, key)}
      />
    );
  });
  if (selected) nodes.push(single(selected, true));

  return (
    <>
      {nodes}
      {list && (
        <Popup
          key={list.key}
          position={list.at}
          minWidth={280}
          maxWidth={320}
          maxHeight={320}
          eventHandlers={{ remove: () => setList(null) }}
        >
          <div className="flex flex-col gap-2 bg-surface p-3.5 text-ink">
            <div className="font-semibold">В одном месте {meetings(list.items.length)}</div>
            {list.items.map((event) => (
              <PopupLink key={event.id} to={`/events/${event.id}`}>
                {event.title}
                <span className="block text-sm text-ink-muted">
                  {when(event)}
                  {event.joinMode === 'request' && ' · по заявке'}
                </span>
              </PopupLink>
            ))}
          </div>
        </Popup>
      )}
    </>
  );
}

function EventMarker({
  event,
  sport,
  selected,
  scale,
  onSelect,
  markers,
}: {
  event: Placed;
  sport: Sport | undefined;
  selected: boolean;
  scale: number;
  onSelect?: (id: string) => void;
  markers: Map<string, L.Marker>;
}) {
  const slug = sport?.slug ?? '';
  const label = `${event.title}, ${when(event)}${event.joinMode === 'request' ? ', по заявке' : ''}`;
  return (
    <Marker
      ref={(marker) => {
        if (marker) markers.set(event.id, marker);
        else markers.delete(event.id);
      }}
      eventHandlers={{
        add: ariaLabel(label),
        ...(onSelect && { click: () => onSelect(event.id) }),
      }}
      position={[event.lat, event.lng]}
      zIndexOffset={selected ? 1000 : 0}
      icon={cachedIcon(`event:${slug}:${event.joinMode}:${selected}:${scale}`, () =>
        eventPin({ sportSlug: slug, joinMode: event.joinMode, selected, scale }),
      )}
    >
      <Tooltip direction="top" className="map-tip" opacity={1}>
        <span className="map-tip__title">{event.title}</span>
        <span className="map-tip__muted">{when(event)}</span>
      </Tooltip>
      <Popup minWidth={300} maxWidth={300}>
        <EventPopup event={event} sport={sport} />
      </Popup>
    </Marker>
  );
}

/** Группа встреч: круг с числом, кольцо — цвета их видов спорта; подсказка — что внутри. */
function GroupMarker({
  group,
  at,
  sportsById,
  scale,
  onOpen,
}: {
  group: PointGroup<Placed>;
  at: L.LatLng;
  sportsById: Map<string, Sport>;
  scale: number;
  onOpen: () => void;
}) {
  const slugs = group.items.map((event) => sportsById.get(event.sportId)?.slug ?? '');
  const colors = [...new Set(slugs)].map(sportColor);
  const names = [
    ...new Set(group.items.map((event) => sportsById.get(event.sportId)?.name ?? 'Спорт')),
  ];
  const count = group.items.length;
  const label = `${meetings(count)} рядом: ${names.join(', ')}`;
  return (
    <Marker
      position={at}
      zIndexOffset={600}
      eventHandlers={{ add: ariaLabel(label), click: onOpen }}
      icon={cachedIcon(`group:${count}:${colors.join(',')}:${scale}`, () =>
        clusterPin({ count, colors, scale }),
      )}
    >
      <Tooltip direction="top" className="map-tip" opacity={1}>
        <span className="map-tip__title">{meetings(count)} рядом</span>
        <span className="map-tip__muted">{names.slice(0, 4).join(', ')}</span>
        <span className="map-tip__muted">Нажмите, чтобы рассмотреть</span>
      </Tooltip>
    </Marker>
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
      <span>{when(event)}</span>
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

const FLY_SECONDS = 0.6;

/**
 * Переход к встрече по «На карте»: карта летит к точке, а попап открывается, когда метка есть
 * на карте. Если встреча была за краем, метка появится после загрузки новой области.
 */
function FocusWatcher({
  focus,
  markers,
  events,
}: {
  focus?: MapFocus;
  markers: Map<string, L.Marker>;
  events: EventMapItem[];
}) {
  const map = useMap();
  const pending = useRef<string | null>(null);
  const flying = useRef(false);

  const open = () => {
    const marker = pending.current ? markers.get(pending.current) : undefined;
    if (!marker) return;
    pending.current = null;
    marker.openPopup();
  };

  useEffect(() => {
    if (!focus) return;
    pending.current = focus.id;
    flying.current = true;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: FLY_SECONDS });
    // Попап — после перелёта: иначе автосдвиг под попап спорит с анимацией.
    const timer = setTimeout(
      () => {
        flying.current = false;
        open();
      },
      FLY_SECONDS * 1000 + 100,
    );
    return () => clearTimeout(timer);
    // Только на новое нажатие «На карте»; key меняется при каждом.
  }, [focus?.key]);

  // Метка встречи из-за края карты появляется после загрузки новой области.
  useEffect(() => {
    if (!flying.current) open();
  }, [events]);
  return null;
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
