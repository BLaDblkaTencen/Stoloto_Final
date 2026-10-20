// Карта встреч (задача 2.10): события в видимой области, метки по виду спорта, попап с кнопкой.
// Ленивая часть EventsMap: всё, что требует Leaflet.
//
// Метки «умные»: что на этом масштабе налезло бы друг на друга, собирается в группу с числом.
// Встречи — круг с кольцом из цветов их видов спорта, площадки — жёлтый квадрат; со слоем
// площадок встречи и площадки группируются вместе, чтобы группы не закрывали друг друга.
// Нажатие на группу приближает карту к ней, а всё, что в одном месте, показывает списком.
// Наведение — название и время встречи. Метка с открытым попапом и выбранная встреча в группы
// не уходят.
import type { EventMapItem } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import type { Bbox, Venue } from '@sport/shared/schemas/venues';
import type L from 'leaflet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import {
  countOf,
  expandGroup,
  GROUP_RADIUS,
  GroupMarker,
  groupKey,
  HEAD_OFFSET,
  useScreenGroups,
} from './groups';
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

// Время встречи в поясе устройства, как в ленте и карточке.
const dateFormat = new Intl.DateTimeFormat('ru', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const when = (event: EventMapItem) => dateFormat.format(new Date(event.startsAt));
const meetings = (n: number) => countOf(n, ['встреча', 'встречи', 'встреч']);
const places = (n: number) => countOf(n, ['площадка', 'площадки', 'площадок']);

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
      <Markers
        events={ownPoints}
        venues={venues}
        atVenue={atVenue}
        createHref={createHref}
        sportsById={sportsById}
        selectedId={selectedId}
        onSelect={onSelect}
        markers={markers.current}
      />
    </BaseMap>
  );
}

type Placed = EventMapItem & { lat: number; lng: number };
const placed = (event: EventMapItem): event is Placed => event.lat !== null && event.lng !== null;

/** Метка на карте: встреча или площадка. id с приставкой — у встречи и площадки не совпадут. */
type Item =
  | { kind: 'event'; id: string; lat: number; lng: number; event: Placed }
  | { kind: 'venue'; id: string; lat: number; lng: number; venue: Venue };

/**
 * Все метки карты с группировкой. Выбранная встреча («На карте» в ленте, нажатие на метку) и
 * метка с открытым попапом в группы не попадают: должны остаться видны именно они. Все метки —
 * в одном массиве с ключом по id: React двигает метку, а не пересоздаёт (иначе открытый попап
 * закрылся бы, а исчезнувшая с открытым попапом метка зацикливает react-leaflet).
 */
function Markers({
  events,
  venues,
  atVenue,
  createHref,
  sportsById,
  selectedId,
  onSelect,
  markers,
}: {
  events: EventMapItem[];
  venues: Venue[];
  atVenue: Map<string, EventMapItem[]>;
  createHref: ((venue: Venue) => string) | null;
  sportsById: Map<string, Sport>;
  selectedId?: string;
  onSelect?: (id: string) => void;
  markers: Map<string, L.Marker>;
}) {
  const map = useMap();
  const zoom = useMapZoom();
  // Вблизи метки мельче: не закрывают соседние и точнее стоят на месте (pinScale).
  const scale = pinScale(zoom);
  const [openId, setOpenId] = useState<string | null>(null);
  const [list, setList] = useState<{ key: string; at: L.LatLng; items: Item[] } | null>(null);
  // Другой масштаб — другие группы: список старой группы закрываем.
  useEffect(() => setList(null), [zoom]);

  const items: Item[] = [
    ...events.filter(placed).map((event): Item => ({
      kind: 'event',
      id: `e:${event.id}`,
      lat: event.lat,
      lng: event.lng,
      event,
    })),
    ...venues.map((venue): Item => ({
      kind: 'venue',
      id: `v:${venue.id}`,
      lat: venue.lat,
      lng: venue.lng,
      venue,
    })),
  ];
  const pinned = (item: Item) =>
    item.id === openId || (item.kind === 'event' && item.event.id === selectedId);
  const { groups, position } = useScreenGroups(
    items.filter((item) => !pinned(item)),
    (item) => [item.lat, item.lng],
    GROUP_RADIUS * scale,
  );

  const opened = (id: string) => ({
    onOpen: () => setOpenId(id),
    onClose: () => setOpenId((current) => (current === id ? null : current)),
  });
  const single = (item: Item) =>
    item.kind === 'event' ? (
      <EventMarker
        key={item.id}
        event={item.event}
        sport={sportsById.get(item.event.sportId)}
        selected={item.event.id === selectedId}
        scale={scale}
        onSelect={onSelect}
        markers={markers}
        {...opened(item.id)}
      />
    ) : (
      <VenueMarker
        key={item.id}
        venue={item.venue}
        here={atVenue.get(item.venue.id) ?? []}
        createHref={createHref}
        scale={scale}
        {...opened(item.id)}
      />
    );

  const nodes = groups.map((group) => {
    if (group.items.length === 1) return single(group.items[0]);
    const key = groupKey('group', group);
    const groupEvents = group.items.flatMap((item) => (item.kind === 'event' ? [item.event] : []));
    const groupVenues = group.items.flatMap((item) => (item.kind === 'venue' ? [item.venue] : []));
    const sports = groupEvents.map((event) => sportsById.get(event.sportId));
    const colors = [
      ...new Set(sports.map((sport) => sportColor(sport?.slug ?? ''))),
      ...(groupVenues.length ? ['var(--color-accent)'] : []),
    ];
    const what = [
      groupEvents.length ? meetings(groupEvents.length) : '',
      groupVenues.length ? places(groupVenues.length) : '',
    ]
      .filter(Boolean)
      .join(' и ');
    const names = [
      ...new Set([
        ...sports.map((sport) => sport?.name ?? 'Спорт'),
        ...groupVenues.map((venue) => venue.name),
      ]),
    ];
    // Головки «капель» выше их точек: группа встреч — там же; у площадок метка по центру точки.
    const at = position(group, (HEAD_OFFSET * scale * groupEvents.length) / group.items.length);
    const onlyVenues = groupEvents.length === 0;
    return (
      <GroupMarker
        key={key}
        at={at}
        icon={cachedIcon(
          `group:${group.items.length}:${colors.join(',')}:${onlyVenues}:${scale}`,
          () =>
            clusterPin({
              count: group.items.length,
              colors,
              shape: onlyVenues ? 'square' : 'circle',
              scale,
            }),
        )}
        label={`${what} рядом: ${names.join(', ')}`}
        onClick={() =>
          expandGroup(
            map,
            group.items.map((item) => [item.lat, item.lng]),
            () => setList({ key, at, items: group.items }),
          )
        }
      >
        <span className="map-tip__title">{what} рядом</span>
        <span className="map-tip__muted">
          {names.slice(0, 4).join(', ')}
          {names.length > 4 && '…'}
        </span>
      </GroupMarker>
    );
  });
  for (const item of items.filter(pinned)) nodes.push(single(item));

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
          <SamePlaceList items={list.items} createHref={createHref} />
        </Popup>
      )}
    </>
  );
}

/** Всё, что стоит в одном месте: встречи — ссылками, площадки — с «Создать встречу здесь». */
function SamePlaceList({
  items,
  createHref,
}: {
  items: Item[];
  createHref: ((venue: Venue) => string) | null;
}) {
  const count = items.filter((item) => item.kind === 'event').length;
  return (
    <div className="flex flex-col gap-2 bg-surface p-3.5 text-ink">
      <div className="font-semibold">
        {count ? `В одном месте ${meetings(count)}` : `В одном месте ${places(items.length)}`}
      </div>
      {items.map((item) =>
        item.kind === 'event' ? (
          <PopupLink key={item.id} to={`/events/${item.event.id}`}>
            {item.event.title}
            <span className="block text-sm text-ink-muted">
              {when(item.event)}
              {item.event.joinMode === 'request' && ' · по заявке'}
            </span>
          </PopupLink>
        ) : (
          <div key={item.id} className="flex flex-col gap-1">
            <span className="leading-snug">{item.venue.name}</span>
            <span className="text-sm text-ink-muted">{item.venue.address}</span>
            {createHref && <PopupLink to={createHref(item.venue)}>Создать встречу здесь</PopupLink>}
          </div>
        ),
      )}
    </div>
  );
}

function VenueMarker({
  venue,
  here,
  createHref,
  scale,
  onOpen,
  onClose,
}: {
  venue: Venue;
  here: EventMapItem[];
  createHref: ((venue: Venue) => string) | null;
  scale: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  const suitable = venue.suitable ?? true;
  // Где уже есть встречи — обводка: видно, где собираются, а соседей метка не закрывает.
  const busy = here.length > 0;
  const label = busy ? `${venue.name}: ${meetings(here.length)}` : venue.name;
  return (
    <Marker
      position={[venue.lat, venue.lng]}
      zIndexOffset={busy ? 500 : suitable ? 100 : 0}
      eventHandlers={{ add: ariaLabel(label), popupopen: onOpen, popupclose: onClose }}
      icon={cachedIcon(`venue:${venue.type}:${suitable}:busy-${busy}:${scale}`, () =>
        venuePin({ type: venue.type, suitable, busy, scale }),
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
}

function EventMarker({
  event,
  sport,
  selected,
  scale,
  onSelect,
  onOpen,
  onClose,
  markers,
}: {
  event: Placed;
  sport: Sport | undefined;
  selected: boolean;
  scale: number;
  onSelect?: (id: string) => void;
  onOpen: () => void;
  onClose: () => void;
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
        popupopen: onOpen,
        popupclose: onClose,
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

function EventPopup({ event, sport }: { event: EventMapItem; sport: Sport | undefined }) {
  const seats =
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
      <span>{seats}</span>
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
