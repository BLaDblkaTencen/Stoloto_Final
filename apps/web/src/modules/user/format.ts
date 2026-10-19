// Даты и числа для экранов зоны «Пользователь». Время всегда показываем в поясе города
// мероприятий (EVENT_TIMEZONE), а не браузера: эксперт из Москвы видит то же время, что и организатор.
import { EVENT_TIMEZONE } from '@sport/shared/schemas/events';

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: EVENT_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: EVENT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});
// en-CA даёт ГГГГ-ММ-ДД — формат параметра date в API.
const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: EVENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «Сб, 26 октября · 08:00–09:30». */
export function formatWhen(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  const day = capitalize(dayFormat.format(start));
  const from = timeFormat.format(start);
  if (!endsAt) return `${day} · ${from}`;
  const end = new Date(endsAt);
  const sameDay = dayFormat.format(start) === dayFormat.format(end);
  return sameDay
    ? `${day} · ${from}–${timeFormat.format(end)}`
    : `${day} · ${from} — ${capitalize(dayFormat.format(end))} · ${timeFormat.format(end)}`;
}

/** «26 октября, 14:05» — для времени заявки и комментариев. */
export function formatMoment(value: string) {
  const date = new Date(value);
  return `${dayFormat.format(date).replace(/^\S+,\s*/, '')}, ${timeFormat.format(date)}`;
}

export const LOCAL_TIME_NOTE = 'Время местное, по Красноярску';

/** Сегодняшняя дата в поясе мероприятий, со сдвигом на days дней: «2026-10-26». */
export function isoDay(days = 0, from = new Date()) {
  return isoDayFormat.format(new Date(from.getTime() + days * 86_400_000));
}

/** «3 места», «1 место», «12 мест». */
export function plural(n: number, [one, few, many]: readonly [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** «Участвуют 8 из 10, свободно 2» или «Участвуют 6, без ограничения мест». */
export function formatSeats(participants: number, capacity: number | null) {
  if (capacity === null) return `Участвуют: ${participants}, мест без ограничения`;
  const free = Math.max(0, capacity - participants);
  return free === 0
    ? `Участвуют ${participants} из ${capacity}, мест нет`
    : `Участвуют ${participants} из ${capacity}, свободно ${plural(free, ['место', 'места', 'мест'])}`;
}

// Красноярск живёт по UTC+7 круглый год (переходов на летнее время нет с 2014 года),
// поэтому смещение постоянное и дату с временем из формы можно перевести в UTC без библиотек.
const EVENT_UTC_OFFSET = '+07:00';

/** Дата и время из полей формы (по Красноярску) → ISO в UTC для API; '' — если поле пустое. */
export function toUtcIso(date: string, time: string) {
  if (!date || !time) return '';
  const value = new Date(`${date}T${time}:00${EVENT_UTC_OFFSET}`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

const timeOfDayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: EVENT_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO из API → поля формы: { date: '2026-10-26', time: '19:00' } по Красноярску. */
export function localParts(iso: string) {
  const date = new Date(iso);
  return { date: isoDayFormat.format(date), time: timeOfDayFormat.format(date) };
}
