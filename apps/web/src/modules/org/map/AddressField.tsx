// Поле «Адрес или место» в форме встречи, связанное с картой «Место встречи». Владелец: участник 2.
//
//   <AddressField value={address} onChange={setAddress} place={place} onPlace={setPlace} … />
//
// Адрес → карта: по кнопке «Найти на карте», по Enter или при уходе из поля ставим точку по адресу,
// и карта под полем приближается к ней. Карта → адрес: точку отметили на карте, а поле пустое —
// подставляем адрес этой точки. Подсказок на каждую букву нет: так требуют правила Nominatim.
import type { GeocodePlace } from '@sport/shared/schemas/geocoding';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { Button, Icon, TextField } from '../../../shared/ui';
import { geocodeAddress, reverseGeocode } from './api';
import type { PlaceValue } from './MapPicker';

export type AddressFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Место встречи из MapPicker: по адресу ставим точку, по точке подставляем адрес. */
  place: PlaceValue;
  onPlace: (place: PlaceValue) => void;
  hint: string;
  error?: string;
  maxLength?: number;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found'; places: GeocodePlace[]; chosen: GeocodePlace }
  | { kind: 'pointed'; place: GeocodePlace }
  | { kind: 'notFound' }
  | { kind: 'failed'; message: string };

const where = (place: GeocodePlace) =>
  place.context ? `${place.label} · ${place.context}` : place.label;

export function AddressField({
  value,
  onChange,
  place,
  onPlace,
  hint,
  error,
  maxLength,
}: AddressFieldProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // Что уже искали: уход из поля без правок не повторяет запрос.
  const searched = useRef('');
  // Адрес, который подставили сами по точке: его можно заменить адресом новой точки.
  const suggested = useRef('');
  const request = useRef(0);
  const venue = place?.kind === 'venue';

  const search = async (trigger: 'blur' | 'button') => {
    const q = value.trim();
    if (venue) return;
    if (trigger === 'blur') {
      // Точку отметили на карте сами — адрес её не переставляет, только кнопка.
      if (place?.kind === 'point' && !place.found) return;
      if (q.length < 3 || q === searched.current) return;
    }
    if (q.length < 3) {
      setStatus({ kind: 'failed', message: 'Впишите адрес: хотя бы улицу или название места' });
      return;
    }
    searched.current = q;
    const id = ++request.current;
    setStatus({ kind: 'searching' });
    try {
      const { items } = await geocodeAddress(q);
      if (id !== request.current) return;
      if (items.length === 0) {
        setStatus({ kind: 'notFound' });
        return;
      }
      choose(items, items[0]);
    } catch (err) {
      if (id !== request.current) return;
      setStatus({
        kind: 'failed',
        message:
          err instanceof ApiError
            ? err.message
            : 'Не получилось найти адрес. Отметьте место на карте',
      });
    }
  };

  const choose = (places: GeocodePlace[], chosen: GeocodePlace) => {
    onPlace({ kind: 'point', lat: chosen.lat, lng: chosen.lng, found: chosen });
    setStatus({ kind: 'found', places, chosen });
  };

  // Точка с карты → адрес в пустое поле. Ключ — координаты, чтобы не искать заново на каждый рендер;
  // точку, с которой форма открылась (правка встречи), не трогаем.
  const manualPoint = place?.kind === 'point' && !place.found ? place : null;
  const pointKey = manualPoint ? `${manualPoint.lat},${manualPoint.lng}` : null;
  const initialPoint = useRef(pointKey);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (!manualPoint || pointKey === initialPoint.current) return;
    const id = ++request.current;
    reverseGeocode(manualPoint.lat, manualPoint.lng)
      .then(({ place: near }) => {
        if (id !== request.current || !near) return;
        setStatus({ kind: 'pointed', place: near });
        const current = latest.current.trim();
        if (current === '' || current === suggested.current) {
          suggested.current = near.label;
          searched.current = near.label;
          onChange(near.label);
        }
      })
      // Адрес по точке — только подсказка: без него точка всё равно выбрана.
      .catch(() => undefined);
  }, [pointKey]);

  // Выбрали площадку или убрали место — старый результат поиска больше не про это место.
  useEffect(() => {
    if (!place || venue) setStatus({ kind: 'idle' });
  }, [place, venue]);

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Адрес или место"
        hint={hint}
        placeholder="Остров Татышев, главный вход"
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (status.kind !== 'searching') setStatus({ kind: 'idle' });
        }}
        onBlur={() => void search('blur')}
        onKeyDown={(e) => {
          // Enter в поле адреса ищет его на карте, а не отправляет всю форму.
          if (e.key === 'Enter') {
            e.preventDefault();
            void search('button');
          }
        }}
        error={error}
      />
      {!venue && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="secondary"
            loading={status.kind === 'searching'}
            onClick={() => void search('button')}
          >
            <Icon name="search" size={18} />
            Найти на карте
          </Button>
          <AddressStatus status={status} onChoose={choose} />
        </div>
      )}
    </div>
  );
}

function AddressStatus({
  status,
  onChoose,
}: {
  status: Status;
  onChoose: (places: GeocodePlace[], chosen: GeocodePlace) => void;
}) {
  let body = null;
  if (status.kind === 'searching') body = <p>Ищем адрес…</p>;
  else if (status.kind === 'notFound') {
    body = (
      <p>
        Такой адрес в Красноярске не нашли. Уточните улицу и дом или нажмите на нужное место карты.
      </p>
    );
  } else if (status.kind === 'failed') body = <p>{status.message}</p>;
  else if (status.kind === 'pointed') {
    body = <p>Точка на карте: {where(status.place)}</p>;
  } else if (status.kind === 'found') {
    const others = status.places.filter((place) => place !== status.chosen);
    body = (
      <div className="flex flex-col gap-2">
        <p>
          <span className="font-semibold text-ink">На карте: {where(status.chosen)}.</span> Не то
          место — нажмите на карту, где встречаетесь.
        </p>
        {others.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Или другое место:</span>
            {others.map((other) => (
              <Button
                key={`${other.lat},${other.lng}`}
                variant="secondary"
                onClick={() => onChoose(status.places, other)}
              >
                {where(other)}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <div aria-live="polite" className="min-w-0 flex-[1_1_240px] text-sm text-ink-muted">
      {body}
    </div>
  );
}
