// Место одной встречи на карте. Ленивая часть PlaceMap.
// Метка та же, что в ленте и на большой карте: «капля» вида спорта; без вида спорта — метка
// площадки или общая точка.
import type { JoinMode, VenueType } from '@sport/shared';
import { Marker } from 'react-leaflet';
import { eventPin, pinIcon, pinScale, venuePin } from '../../../shared/ui';
import { ariaLabel, BaseMap, cachedIcon, useMapZoom } from './BaseMap';

const ZOOM = 15;

export type PlaceMapViewProps = {
  lat: number;
  lng: number;
  title: string;
  /** Тип площадки; без него — своя точка организатора. */
  venueType?: VenueType;
  /** Вид спорта и режим записи встречи: метка как на карте встреч. */
  sportSlug?: string;
  joinMode?: JoinMode;
  className?: string;
};

export function PlaceMapView({ lat, lng, title, className, ...pin }: PlaceMapViewProps) {
  return (
    <BaseMap
      label={`Место встречи: ${title}`}
      center={[lat, lng]}
      zoom={ZOOM}
      className={className}
    >
      <PlaceMarker lat={lat} lng={lng} title={title} {...pin} />
    </BaseMap>
  );
}

function PlaceMarker({
  lat,
  lng,
  title,
  venueType,
  sportSlug,
  joinMode = 'free',
}: Omit<PlaceMapViewProps, 'className'>) {
  // Вблизи метки мельче и точнее стоят на месте (pinScale).
  const scale = pinScale(useMapZoom());
  const icon = sportSlug
    ? cachedIcon(`event:${sportSlug}:${joinMode}:false:${scale}`, () =>
        eventPin({ sportSlug, joinMode, scale }),
      )
    : venueType
      ? cachedIcon(`venue:${venueType}:true:true:${scale}`, () =>
          venuePin({ type: venueType, suitable: true, selected: true, scale }),
        )
      : cachedIcon(`point:${scale}`, () =>
          pinIcon({ icon: 'pin', color: 'var(--color-accent)', scale }),
        );
  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{ add: ariaLabel(`Место встречи: ${title}`) }}
    />
  );
}

export default PlaceMapView;
