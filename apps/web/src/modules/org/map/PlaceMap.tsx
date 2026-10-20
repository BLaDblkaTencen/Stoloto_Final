// Место встречи в карточке события (задачи 1.10, 2.11): небольшая карта с одной меткой и ссылка
// на OpenStreetMap для маршрута. Leaflet грузится лениво; адрес текстом стоит рядом, поэтому без
// карты карточка остаётся полной.
//
//   {event.lat !== null && event.lng !== null && (
//     <PlaceMap lat={event.lat} lng={event.lng} title={event.venue?.name ?? event.address}
//               venueType={event.venue?.type} />
//   )}
import { lazy } from 'react';
import { MapBoundary } from './MapBoundary';
import type { PlaceMapViewProps } from './PlaceMapView';

const PlaceMapView = lazy(() => import('./PlaceMapView'));

export function PlaceMap({ className = 'h-[260px]', ...props }: PlaceMapViewProps) {
  const { lat, lng } = props;
  return (
    <div className="flex flex-col gap-2">
      <MapBoundary className={className}>
        <PlaceMapView {...props} className={className} />
      </MapBoundary>
      {/* Ссылка уводит на чужой сайт в новой вкладке — так и подписана, чтобы не обещать нашу карту. */}
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        target="_blank"
        rel="noreferrer"
        className="tap-area self-start text-sm font-semibold"
      >
        Открыть место на OpenStreetMap <span aria-hidden="true">↗</span>
        <span className="sr-only"> (в новой вкладке)</span>
      </a>
    </div>
  );
}
