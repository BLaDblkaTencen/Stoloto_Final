// Основа всех карт зоны: Leaflet, подложка OpenStreetMap, стиль map-frame и запасное состояние.
// Файл грузится лениво вместе с Leaflet, поэтому в первый экран сайта карта не попадает.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useRef, useState, type ReactNode } from 'react';
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet';
import { MapUnavailable } from '../../../shared/ui';

/** Центр Красноярска (у Центрального парка) — город демо-данных. */
export const CITY_CENTER: [number, number] = [56.01, 92.853];

// Если подряд не загрузилось столько плиток и ни одной удачной — сети нет или OSM недоступен.
const TILE_ERRORS_LIMIT = 4;

export function BaseMap({
  center = CITY_CENTER,
  zoom = 13,
  className = 'h-[480px]',
  label,
  children,
}: {
  center?: [number, number];
  zoom?: number;
  /** Высота карты классом Tailwind. */
  className?: string;
  /** Подпись карты для экранного диктора. */
  label: string;
  children?: ReactNode;
}) {
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tiles = useRef({ loaded: 0, failed: 0 });

  if (unavailable) {
    return (
      <div className={`map-frame overflow-hidden ${className}`}>
        <MapUnavailable
          onRetry={() => {
            tiles.current = { loaded: 0, failed: 0 };
            setUnavailable(false);
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <MapContainer
      key={attempt}
      center={center}
      zoom={zoom}
      className={`map-frame ${className}`}
      aria-label={label}
      // Колесо прокрутки двигает страницу, а не карту: иначе страницу с картой трудно пролистать.
      scrollWheelZoom={false}
      attributionControl={false}
    >
      {/* Без префикса «Leaflet»: его лицензия ссылки не требует. «© OpenStreetMap» обязателен (ODbL). */}
      <AttributionControl prefix={false} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
        eventHandlers={{
          tileload: () => {
            tiles.current.loaded += 1;
          },
          tileerror: () => {
            tiles.current.failed += 1;
            if (tiles.current.loaded === 0 && tiles.current.failed >= TILE_ERRORS_LIMIT) {
              setUnavailable(true);
            }
          },
        }}
      />
      {children}
    </MapContainer>
  );
}

// Иконки меток создаются один раз на набор параметров: при перерисовке Leaflet не пересоздаёт DOM меток.
const iconCache = new Map<string, L.DivIcon>();

export function cachedIcon(key: string, make: () => L.DivIconOptions): L.DivIcon {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon(make());
    iconCache.set(key, icon);
  }
  return icon;
}
