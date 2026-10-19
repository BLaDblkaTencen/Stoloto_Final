// Место одной встречи на карте: метка площадки или своей точки. Ленивая часть PlaceMap.
import type { VenueType } from '@sport/shared';
import { Marker } from 'react-leaflet';
import { pinIcon, venuePin } from '../../../shared/ui';
import { BaseMap, cachedIcon } from './BaseMap';

export type PlaceMapViewProps = {
  lat: number;
  lng: number;
  title: string;
  /** Тип площадки; без него — своя точка организатора. */
  venueType?: VenueType;
  className?: string;
};

export function PlaceMapView({ lat, lng, title, venueType, className }: PlaceMapViewProps) {
  return (
    <BaseMap label={`Место встречи: ${title}`} center={[lat, lng]} zoom={15} className={className}>
      <Marker
        position={[lat, lng]}
        title={title}
        icon={
          venueType
            ? cachedIcon(`venue:${venueType}:true:true`, () =>
                venuePin({ type: venueType, suitable: true, selected: true }),
              )
            : cachedIcon('point', () =>
                pinIcon({ icon: 'pin', color: 'var(--color-accent)', selected: true }),
              )
        }
      />
    </BaseMap>
  );
}

export default PlaceMapView;
