// Основа всех карт зоны: Leaflet, подложка OpenStreetMap, стиль map-frame и запасное состояние.
// Файл грузится лениво вместе с Leaflet, поэтому в первый экран сайта карта не попадает.
//
// Удобство одинаковое на всех картах: колесо мыши листает страницу, а масштаб меняется колесом
// с Ctrl (⌘) или жестом на тачпаде — подсказка об этом появляется сама; справа сверху кнопки
// «Во весь экран» и «Где я».
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AttributionControl,
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import { Icon, MapUnavailable, mePin } from '../../../shared/ui';

/** Центр Красноярска (у Центрального парка) — город демо-данных. */
export const CITY_CENTER: [number, number] = [56.01, 92.853];

/** Масштаб карты, если его не задали явно: город целиком. */
export const DEFAULT_ZOOM = 13;

// Если подряд не загрузилось столько плиток и ни одной удачной — сети нет или OSM недоступен.
const TILE_ERRORS_LIMIT = 4;

export function BaseMap({
  center = CITY_CENTER,
  zoom = DEFAULT_ZOOM,
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
      attributionControl={false}
      zoomControl={false}
    >
      {/* Без префикса «Leaflet»: его лицензия ссылки не требует. «© OpenStreetMap» обязателен (ODbL). */}
      <AttributionControl prefix={false} />
      {/* Свои кнопки масштаба — ради русских подписей: у Leaflet «Zoom in» в подсказке и для диктора. */}
      <ZoomControl zoomInTitle="Приблизить" zoomOutTitle="Отдалить" />
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
      <WheelGuard />
      <MapTools />
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

/**
 * Текущий масштаб карты для частей, которые от него зависят (размер меток, группы).
 * Меняется после приближения или отдаления, а не на каждом кадре анимации.
 */
export function useMapZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return zoom;
}

/**
 * Подпись метки для экранного диктора — aria-label на её элементе. title не ставим: браузер
 * показал бы свою подсказку поверх нашей (Tooltip map-tip). Обработчик события add метки.
 */
export function ariaLabel(text: string) {
  return (event: L.LeafletEvent) => {
    (event.target as L.Marker).getElement()?.setAttribute('aria-label', text);
  };
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const HINT_MS = 1500;

/**
 * Колесо мыши над картой листает страницу, как везде на сайте; масштаб — колесом с Ctrl (⌘),
 * жест «щипок» на тачпаде браузер присылает так же. Без Ctrl — короткая подсказка поверх карты.
 * Перехват в фазе погружения: обработчик Leaflet на контейнере такое колесо не видит.
 */
function WheelGuard() {
  const map = useMap();
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const container = map.getContainer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      // Попап и кнопки листаются сами: Leaflet туда колесо не пускает.
      if ((event.target as Element).closest('.leaflet-popup, .leaflet-control, .map-tools')) return;
      event.stopImmediatePropagation();
      setHint(true);
      clearTimeout(timer);
      timer = setTimeout(() => setHint(false), HINT_MS);
    };
    container.addEventListener('wheel', onWheel, { capture: true });
    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true });
      clearTimeout(timer);
    };
  }, [map]);
  return (
    <div aria-hidden="true" className={`map-hint ${hint ? 'is-visible' : ''}`}>
      Чтобы изменить масштаб, крутите колесо с зажатым {IS_MAC ? '⌘' : 'Ctrl'}
    </div>
  );
}

/** Дальше этого от центра — «вы не в Красноярске»: встречи пока только там. */
const CITY_RADIUS_M = 60_000;
const TOAST_MS = 4000;
const LOCATE_ZOOM = 15;

/** Кнопки «Во весь экран» и «Где я» справа сверху; точка «вы здесь» после «Где я». */
function MapTools() {
  const map = useMap();
  const tools = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [locating, setLocating] = useState(false);
  const [me, setMe] = useState<{ at: L.LatLng; accuracy: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  useEffect(() => {
    const node = tools.current;
    // Нажатие на кнопку не должно ставить точку или закрывать попап на карте под ней.
    if (node) {
      L.DomEvent.disableClickPropagation(node);
      L.DomEvent.disableScrollPropagation(node);
    }
    const onFullscreen = () => {
      setFull(document.fullscreenElement === map.getContainer());
      map.invalidateSize();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      clearTimeout(toastTimer.current);
    };
  }, [map]);

  useMapEvents({
    locationfound: (event) => {
      setLocating(false);
      setMe({ at: event.latlng, accuracy: event.accuracy });
      if (map.distance(event.latlng, CITY_CENTER) > CITY_RADIUS_M) {
        say('Вы не в Красноярске, а встречи пока только там');
        return;
      }
      map.flyTo(event.latlng, Math.max(map.getZoom(), LOCATE_ZOOM), { duration: 0.8 });
    },
    locationerror: (event) => {
      setLocating(false);
      say(
        event.code === 1
          ? 'Браузер не дал узнать, где вы: разрешите доступ к геопозиции'
          : 'Не получилось определить, где вы',
      );
    },
  });

  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return (
    <>
      <div ref={tools} className="map-tools">
        {canFullscreen && (
          <button
            type="button"
            className="map-tool"
            aria-label={full ? 'Свернуть карту' : 'Карта во весь экран'}
            aria-pressed={full}
            onClick={() =>
              full ? void document.exitFullscreen() : void map.getContainer().requestFullscreen()
            }
          >
            <Icon name={full ? 'minimize' : 'maximize'} size={22} />
          </button>
        )}
        {canLocate && (
          <button
            type="button"
            className="map-tool"
            aria-label="Показать, где я"
            aria-busy={locating || undefined}
            onClick={() => {
              setLocating(true);
              map.locate({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
            }}
          >
            <Icon name="locate" size={22} />
          </button>
        )}
      </div>
      {toast && (
        <div role="status" className="map-toast">
          {toast}
        </div>
      )}
      {me && me.accuracy < 1500 && (
        <Circle
          center={me.at}
          radius={me.accuracy}
          interactive={false}
          pathOptions={{ className: 'map-me-accuracy' }}
        />
      )}
      {me && (
        <Marker
          position={me.at}
          icon={cachedIcon('me', mePin)}
          interactive={false}
          keyboard={false}
          zIndexOffset={-500}
        />
      )}
    </>
  );
}
