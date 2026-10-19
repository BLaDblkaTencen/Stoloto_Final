// Выбор места встречи для формы события (киллер-фича, задача 2.9). Подключает участник 1 (1.3, 1.10).
//
//   const [place, setPlace] = useState<PlaceValue>(null);
//   <MapPicker sportId={form.sportId} value={place} onChange={setPlace} />
//   // place.kind === 'venue' → venueId = place.venue.id, адрес можно подставить из place.venue.address
//   // place.kind === 'point' → lat, lng; адрес человек пишет сам
//
// Карта грузится лениво. Список площадок под картой работает и без неё: для клавиатуры,
// экранного диктора и на случай, если карта не загрузилась.
import { VENUE_TYPE_LABELS } from '@sport/shared';
import type { Venue, VenueCard as VenueInfo } from '@sport/shared/schemas/venues';
import { lazy } from 'react';
import { Alert, Button, SelectField, VenueCard } from '../../../shared/ui';
import { useVenues } from './api';
import { MapBoundary } from './MapBoundary';
import { venueCardData } from './venueCardData';

export type PlaceValue =
  { kind: 'venue'; venue: VenueInfo } | { kind: 'point'; lat: number; lng: number } | null;

export type MapPickerProps = {
  /** Вид спорта события: подходящие ему площадки подсвечиваются. */
  sportId?: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  /** Ошибка поля venueId или координат от сервера. */
  error?: string;
};

const PickerMap = lazy(() => import('./PickerMap'));
const MAP_HEIGHT = 'h-[420px] md:h-[520px]';

export function MapPicker({ sportId, value, onChange, error }: MapPickerProps) {
  const venues = useVenues(sportId);
  const items = venues.data ?? [];
  const hasHint = sportId !== undefined && items.some((venue) => venue.suitable === false);

  const pickVenue = (venue: Venue) => onChange({ kind: 'venue', venue });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">
        {hasHint
          ? 'Жёлтые метки — площадки, подходящие для этого вида спорта, серые — остальные. '
          : 'Метки — площадки, где можно договориться о встрече. '}
        Нажмите на метку, чтобы выбрать площадку, или на свободное место карты, чтобы поставить свою
        точку (двор, парк).
      </p>

      <MapBoundary className={MAP_HEIGHT}>
        <PickerMap
          venues={items}
          value={value}
          onPickVenue={pickVenue}
          onPickPoint={(lat, lng) => onChange({ kind: 'point', lat, lng })}
        />
      </MapBoundary>

      {venues.isError && (
        <Alert tone="warning">
          Не удалось загрузить площадки. Можно поставить свою точку или указать адрес текстом.
        </Alert>
      )}

      <SelectField
        label="Или выберите площадку из списка"
        placeholder="Площадка не выбрана"
        value={value?.kind === 'venue' ? value.venue.id : ''}
        disabled={items.length === 0}
        options={items.map((venue) => ({
          value: venue.id,
          label: `${venue.name} — ${VENUE_TYPE_LABELS[venue.type].toLowerCase()}${
            venue.suitable ? ', подходит' : ''
          }`,
        }))}
        onChange={(event) => {
          const venue = items.find((item) => item.id === event.target.value);
          onChange(venue ? { kind: 'venue', venue } : null);
        }}
        error={error}
      />

      {value?.kind === 'venue' && (
        <div className="flex flex-col gap-3">
          <VenueCard venue={venueCardData(value.venue)} />
          <Button variant="secondary" className="self-start" onClick={() => onChange(null)}>
            Убрать площадку
          </Button>
        </div>
      )}
      {value?.kind === 'point' && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-surface p-5">
          <p className="font-semibold">Своя точка на карте</p>
          <p className="text-ink-muted">
            Опишите место в поле «Адрес», чтобы участники точно нашли вас: например «у главного
            входа в парк, возле фонтана».
          </p>
          <Button variant="secondary" className="self-start" onClick={() => onChange(null)}>
            Убрать точку
          </Button>
        </div>
      )}
    </div>
  );
}
