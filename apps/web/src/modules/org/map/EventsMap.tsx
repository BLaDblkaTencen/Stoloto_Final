// Карта встреч (задача 2.10). Подключает участник 1 в ленту рядом со списком (1.4, 1.10):
//
//   <EventsMap filters={{ sportId, joinMode, date }} className="h-[780px]" />
//
// Карта сама запрашивает события в видимой области; адрес каждой встречи остаётся в списке ленты,
// поэтому без карты лента работает как обычно.
import type { Bbox } from '@sport/shared/schemas/venues';
import { lazy, useMemo, useState } from 'react';
import { useSports } from '../api';
import { useEventsOnMap, type EventsMapFilters } from './api';
import { MapBoundary } from './MapBoundary';

const EventsMapView = lazy(() => import('./EventsMapView'));

export type EventsMapProps = {
  filters?: EventsMapFilters;
  /** Выделенная метка, например событие, над которым курсор в списке. */
  selectedId?: string;
  /** Высота классом Tailwind. */
  className?: string;
};

export function EventsMap({ filters = {}, selectedId, className = 'h-[480px]' }: EventsMapProps) {
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const events = useEventsOnMap(bbox, filters);
  const sports = useSports();
  const sportsById = useMemo(
    () => new Map((sports.data ?? []).map((sport) => [sport.id, sport])),
    [sports.data],
  );
  const count = events.data?.length;

  return (
    <div className="flex flex-col gap-2">
      <MapBoundary className={className}>
        <EventsMapView
          events={events.data ?? []}
          sportsById={sportsById}
          selectedId={selectedId}
          onBoundsChange={setBbox}
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
      </p>
    </div>
  );
}
