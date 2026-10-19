// Карта встреч (задача 2.10). Подключена в ленту рядом со списком (1.4, 1.10) и на страницу /map:
//
//   <EventsMap filters={{ sportId, joinMode, date }} className="h-[780px]" />
//   <EventsMap filters={…} showVenues />  // ещё и площадки с контактами и «Создать встречу здесь»
//
// Карта сама запрашивает события в видимой области; адрес каждой встречи остаётся в списке ленты,
// поэтому без карты лента работает как обычно.
import { formatBbox, type Bbox, type Venue } from '@sport/shared/schemas/venues';
import { lazy, useCallback, useMemo, useState } from 'react';
import { useMe } from '../../auth/api';
import { useSports } from '../api';
import { roundBbox, useEventsOnMap, useVenues, type EventsMapFilters } from './api';
import { MapBoundary } from './MapBoundary';
import type { MapFocus } from './EventsMapView';

const EventsMapView = lazy(() => import('./EventsMapView'));

export type EventsMapProps = {
  filters?: EventsMapFilters;
  /** Показать площадки: с видом спорта в фильтре подходящие подсвечены. */
  showVenues?: boolean;
  /** Выделенная метка, например событие, над которым курсор в списке. */
  selectedId?: string;
  /** Нажали на метку встречи. */
  onSelect?: (id: string) => void;
  /** Перейти к встрече и открыть её попап. */
  focus?: MapFocus;
  /** Высота классом Tailwind. */
  className?: string;
};

export function EventsMap({
  filters = {},
  showVenues = false,
  selectedId,
  onSelect,
  focus,
  className = 'h-[480px]',
}: EventsMapProps) {
  const [bbox, setBbox] = useState<Bbox | null>(null);
  // Состояние меняется, только когда округлённая область другая: сдвиг карты на пиксели
  // (например, Leaflet подвинул её под открытый попап) не вызывает перерисовку и новый запрос.
  const onBoundsChange = useCallback((next: Bbox) => {
    const rounded = roundBbox(next);
    setBbox((prev) => (prev && formatBbox(prev) === formatBbox(rounded) ? prev : rounded));
  }, []);
  const events = useEventsOnMap(bbox, filters);
  const venues = useVenues(filters.sportId, showVenues);
  const sports = useSports();
  const me = useMe();
  const sportsById = useMemo(
    () => new Map((sports.data ?? []).map((sport) => [sport.id, sport])),
    [sports.data],
  );
  const canCreate = me.data?.role === 'user' || me.data?.role === 'organization';
  const createHref = useMemo(
    () =>
      canCreate
        ? (venue: Venue) =>
            `/events/new?${new URLSearchParams({
              venue: venue.id,
              ...(filters.sportId ? { sport: filters.sportId } : {}),
            })}`
        : null,
    [canCreate, filters.sportId],
  );
  const count = events.data?.length;
  const venueCount = showVenues ? venues.data?.length : undefined;

  return (
    <div className="flex flex-col gap-2">
      <MapBoundary className={className}>
        <EventsMapView
          events={events.data ?? []}
          sportsById={sportsById}
          venues={showVenues ? (venues.data ?? []) : []}
          createHref={createHref}
          selectedId={selectedId}
          onSelect={onSelect}
          focus={focus}
          onBoundsChange={onBoundsChange}
          className={className}
        />
      </MapBoundary>
      <p aria-live="polite" className="text-sm text-ink-muted">
        {events.isError
          ? 'Не удалось загрузить встречи на карте'
          : count === undefined
            ? 'Загружаем встречи…'
            : count === 0
              ? 'В этой части карты встреч нет — сдвиньте или отдалите карту'
              : `На карте встреч: ${count}`}
        {venueCount !== undefined && `. Площадок: ${venueCount}`}
      </p>
    </div>
  );
}
