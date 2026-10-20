// Место одной встречи на карте: метка площадки или своей точки. Ленивая часть PlaceMap.
import type { VenueType } from '@sport/shared';
import { useState } from 'react';
import { Marker } from 'react-leaflet';
import { pinIcon, pinScale, venuePin } from '../../../shared/ui';
import { BaseMap, cachedIcon, PinScaleWatcher } from './BaseMap';

const ZOOM = 15;

export type PlaceMapViewProps = {
  lat: number;
  lng: number;
  title: string;
  /** Тип площадки; без него — своя точка организатора. */
  venueType?: VenueType;
  className?: string;
};

export function PlaceMapView({ lat, lng, title, venueType, className }: PlaceMapViewProps) {
  const [scale, setScale] = useState(() => pinScale(ZOOM));
  return (
    <BaseMap
      label={`Место встречи: ${title}`}
      center={[lat, lng]}
      zoom={ZOOM}
      className={className}
    >
      <PinScaleWatcher onChange={setScale} />
      <Marker
        position={[lat, lng]}
        title={title}
        icon={
          venueType
            ? cachedIcon(`venue:${venueType}:true:true:${scale}`, () =>
                venuePin({ type: venueType, suitable: true, selected: true, scale }),
              )
            : cachedIcon(`point:${scale}`, () =>
                pinIcon({ icon: 'pin', color: 'var(--color-accent)', selected: true, scale }),
              )
        }
      />
    </BaseMap>
  );
}

export default PlaceMapView;
