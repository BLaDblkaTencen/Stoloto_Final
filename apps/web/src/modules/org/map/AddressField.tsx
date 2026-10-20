// Поле «Адрес или место» в форме встречи, связанное с картой «Место встречи». Владелец: участник 2.
//
//   <AddressField value={address} onChange={setAddress} place={place} onPlace={setPlace} … />
//
// Адрес пишут сами, его текст мы не меняем. Вписанное показываем на карте: после паузы в наборе
// (или сразу по Enter) ставим точку по адресу. Не туда — нажатие на карту переставляет точку, а
// следующая правка адреса снова ставит её по адресу: действует то, что сделали последним.
// Подсказок на каждую букву нет — так требуют правила Nominatim; повторы берутся из кэша.
import type { GeocodePlace } from '@sport/shared/schemas/geocoding';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { TextField } from '../../../shared/ui';
import { geocodeAddress } from './api';
import type { PlaceValue } from './MapPicker';

export type AddressFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Место встречи из MapPicker: по адресу ставим точку; у площадки точка своя. */
  place: PlaceValue;
  onPlace: (place: PlaceValue) => void;
  hint: string;
  error?: string;
  maxLength?: number;
};

/** Пауза в наборе, после которой ищем адрес: короче — запрос на каждое слово. */
const TYPING_PAUSE_MS = 900;
const MIN_LENGTH = 3;

type Status =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'shown'; place: GeocodePlace; houseMissing: boolean }
  | { kind: 'notFound' }
  | { kind: 'failed'; message: string };

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
  // Адрес, который уже стоит на карте (или с которым форма открылась): его не ищем заново.
  const shown = useRef(value.trim());
  const request = useRef(0);
  // Что сделали последним: правку адреса или нажатие на карту. Таймер паузы не перебивает клик.
  const lastEdit = useRef<'typed' | 'map'>('typed');
  const venue = place?.kind === 'venue';

  const show = async (q: string) => {
    shown.current = q;
    const id = ++request.current;
    setStatus({ kind: 'searching' });
    try {
      const { items } = await geocodeAddress(q);
      if (id !== request.current) return;
      const [best] = items;
      if (!best) {
        setStatus({ kind: 'notFound' });
        return;
      }
      onPlace({ kind: 'point', lat: best.lat, lng: best.lng, found: best });
      // Вписали номер дома, а нашлась только улица или место без номера — честно говорим.
      const houseMissing = /\d/.test(q) && !/\d/.test(best.label);
      setStatus({ kind: 'shown', place: best, houseMissing });
    } catch (err) {
      if (id !== request.current) return;
      setStatus({
        kind: 'failed',
        message:
          err instanceof ApiError
            ? err.message
            : 'Не получилось показать адрес. Отметьте место на карте',
      });
    }
  };

  // Набрали адрес и остановились — показываем его на карте. У площадки точка своя: адрес — уточнение.
  useEffect(() => {
    const q = value.trim();
    if (venue || q.length < MIN_LENGTH || q === shown.current) return;
    const timer = setTimeout(() => {
      if (lastEdit.current === 'typed') void show(q);
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [value, venue]);

  // Точку переставили на карте или выбрали площадку — статус поиска больше не про это место.
  const manual = place?.kind === 'point' && !place.found;
  useEffect(() => {
    if (manual || venue || !place) {
      if (manual) lastEdit.current = 'map';
      request.current += 1;
      setStatus({ kind: 'idle' });
    }
  }, [manual, venue, place]);

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Адрес или место"
        hint={hint}
        placeholder="Остров Татышев, главный вход"
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          lastEdit.current = 'typed';
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          // Enter показывает адрес на карте сразу, а не отправляет всю форму.
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const q = value.trim();
          if (!venue && q.length >= MIN_LENGTH) void show(q);
        }}
        error={error}
      />
      {!venue && (
        <p aria-live="polite" className="text-sm text-ink-muted">
          {statusText(status, manual)}
        </p>
      )}
    </div>
  );
}

function statusText(status: Status, manual: boolean) {
  if (manual) return 'Точка на карте стоит там, где вы нажали. Адрес — как вы его написали.';
  switch (status.kind) {
    case 'searching':
      return 'Показываем адрес на карте…';
    case 'shown': {
      const where = status.place.context
        ? `${status.place.label}, ${status.place.context}`
        : status.place.label;
      return status.houseMissing
        ? `Дом не нашли, точка стоит на месте «${where}». Нажмите на карту, где именно встречаетесь.`
        : `На карте: ${where}. Не там — нажмите на карту в нужном месте.`;
    }
    case 'notFound':
      return 'Такой адрес на карте не нашли. Нажмите на карту, где встречаетесь, — адрес останется вашим.';
    case 'failed':
      return status.message;
    default:
      return '';
  }
}
