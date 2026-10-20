// Поле «Адрес или место» в форме встречи, связанное с картой «Место встречи». Владелец: участник 2.
//
//   <AddressField value={address} onChange={setAddress} place={place} onPlace={setPlace} … />
//
// Связь в обе стороны, действует то, что сделали последним:
// - вписали адрес — после паузы в наборе (или сразу по Enter) метка встаёт по нему;
// - поставили или перетащили метку на карте — в поле пишется адрес этой точки, он же
//   в подписи над меткой. Дописали к нему подробности («…, подъезд 2») — метка остаётся на месте.
// Подсказок на каждую букву нет — так требуют правила Nominatim; повторы берутся из кэша.
import type { GeocodePlace } from '@sport/shared/schemas/geocoding';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { TextField } from '../../../shared/ui';
import { geocodeAddress, reverseGeocode } from './api';
import type { PlaceValue } from './MapPicker';

export type AddressFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Место встречи из MapPicker: по адресу ставим метку, по метке пишем адрес. */
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
  | { kind: 'locating' }
  | { kind: 'picked'; place: GeocodePlace }
  | { kind: 'noAddress' }
  | { kind: 'failed'; message: string };

const where = (place: GeocodePlace) =>
  place.context ? `${place.label}, ${place.context}` : place.label;

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
  // Адрес, который вписали сами по метке: подробности к нему не двигают метку.
  const filled = useRef('');
  const request = useRef(0);
  // Что сделали последним: правку адреса или метку на карте. Таймер паузы не перебивает метку,
  // а найденный по метке адрес не затирает то, что начали печатать.
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

  // Набрали адрес и остановились — ставим метку по нему. У площадки метка своя: адрес — уточнение.
  useEffect(() => {
    const q = value.trim();
    if (venue || q.length < MIN_LENGTH || q === shown.current) return;
    // Дописали подробности к адресу метки («…, подъезд 2») — метка остаётся, где её поставили.
    if (filled.current && q.startsWith(filled.current)) return;
    const timer = setTimeout(() => {
      if (lastEdit.current === 'typed') void show(q);
    }, TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [value, venue]);

  // Метку поставили или перетащили на карте — пишем в поле адрес этой точки. Ключ — координаты;
  // точку, с которой открылась форма правки, не трогаем: её адрес уже вписан.
  const manual = place?.kind === 'point' && !place.found ? place : null;
  const pointKey = manual ? `${manual.lat},${manual.lng}` : null;
  const initialPoint = useRef(pointKey);
  useEffect(() => {
    if (!manual) return;
    lastEdit.current = 'map';
    if (pointKey === initialPoint.current) return;
    const id = ++request.current;
    setStatus({ kind: 'locating' });
    reverseGeocode(manual.lat, manual.lng)
      .then(({ place: near }) => {
        if (id !== request.current) return;
        if (!near) {
          setStatus({ kind: 'noAddress' });
          return;
        }
        setStatus({ kind: 'picked', place: near });
        // Пока искали, начали печатать сами — своё не затираем.
        if (lastEdit.current !== 'map') return;
        shown.current = near.label;
        filled.current = near.label;
        onChange(near.label);
      })
      .catch((err: unknown) => {
        if (id !== request.current) return;
        setStatus({
          kind: 'failed',
          message:
            err instanceof ApiError
              ? err.message
              : 'Не получилось узнать адрес метки. Впишите его сами',
        });
      });
  }, [pointKey]);

  // Выбрали площадку или убрали место — прежний поиск больше не про это место.
  useEffect(() => {
    if (venue || !place) {
      request.current += 1;
      setStatus({ kind: 'idle' });
    }
  }, [venue, place]);

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
          {statusText(status, Boolean(manual))}
        </p>
      )}
    </div>
  );
}

function statusText(status: Status, manual: boolean) {
  switch (status.kind) {
    case 'searching':
      return 'Показываем адрес на карте…';
    case 'shown':
      return status.houseMissing
        ? `Дом не нашли, метка стоит на месте «${where(status.place)}». Перетащите её туда, где встречаетесь.`
        : `На карте: ${where(status.place)}. Не там — перетащите метку или нажмите на карту в нужном месте.`;
    case 'notFound':
      return 'Такой адрес на карте не нашли. Нажмите на карту, где встречаетесь, — адрес останется вашим.';
    case 'locating':
      return 'Узнаём адрес метки…';
    case 'picked':
      return `Адрес метки: ${where(status.place)}. Можно дописать подробности — метка останется на месте.`;
    case 'noAddress':
      return 'У этого места на карте нет адреса. Впишите, как его найти: например «Центральный парк, у фонтана».';
    case 'failed':
      return status.message;
    default:
      return manual ? 'Метка стоит там, где вы её поставили.' : '';
  }
}
