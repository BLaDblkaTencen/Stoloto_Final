// Даты и числа для экранов зоны «Пользователь». Время показываем в поясе устройства (решение
// капитана): в Москве встреча в 19:00 по Красноярску видна как 15:00, в Красноярске — как 19:00.
// Пояс браузер берёт при загрузке страницы: после перелёта время обновится, когда её перезагрузят.

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});
// en-CA даёт ГГГГ-ММ-ДД — формат параметра date в API.
const isoDayFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Пояс устройства («Europe/Moscow»): в нём сервер считает границы дня в фильтре ленты. */
export const DEVICE_TIMEZONE = new Intl.DateTimeFormat().resolvedOptions().timeZone;

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

const shortDayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** «Сб, 26 окт. · 08:00» — коротко, для стикеров «Мои записи». */
export function formatShort(startsAt: string) {
  const start = new Date(startsAt);
  return `${capitalize(shortDayFormat.format(start))} · ${timeFormat.format(start)}`;
}

/** День «2026-10-24» → «Сб, 24 окт.» — подпись кнопки дня в форме. */
export function formatDayLabel(day: string) {
  // Местный полдень: без пояса в строке Date читает её во времени устройства.
  return capitalize(shortDayFormat.format(new Date(`${day}T12:00:00`)));
}

const monthYearFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «сентября 2026» — для «На «Вместе» с …». */
export function formatSince(iso: string) {
  return monthYearFormat
    .format(new Date(iso))
    .replace(/^\d+\s/, '')
    .replace(/\s?г\.$/, '');
}

/** «26 октября, 14:05» — для времени заявки и комментариев. */
export function formatMoment(value: string) {
  const date = new Date(value);
  return `${dayFormat.format(date).replace(/^\S+,\s*/, '')}, ${timeFormat.format(date)}`;
}

/** «UTC+7» — смещение пояса устройства сейчас, для подписи к времени. */
function deviceOffset() {
  const name = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;
  return name ? name.replace('GMT', 'UTC') : null;
}

const offset = deviceOffset();
export const LOCAL_TIME_NOTE = `Время по часовому поясу вашего устройства${offset ? `, ${offset}` : ''}`;

/** Сегодняшняя дата на устройстве, со сдвигом на days дней: «2026-10-26». */
export function isoDay(days = 0, from = new Date()) {
  // Календарные дни, а не по 24 часа: при переходе на летнее время сутки бывают 23 или 25 часов.
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return isoDayFormat.format(date);
}

/** «08:00» — время начала на устройстве. */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** День встречи на устройстве: «2026-10-26» — ключ для группировки ленты по дням. */
export const eventDay = (iso: string) => isoDayFormat.format(new Date(iso));

/** «Сегодня», «Завтра» или «Сб, 24 окт.» — заголовок дня в ленте. */
export function formatDayHeading(day: string, from = new Date()) {
  if (day === isoDay(0, from)) return 'Сегодня';
  if (day === isoDay(1, from)) return 'Завтра';
  return formatDayLabel(day);
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

/** Дата и время из полей формы (на устройстве) → ISO в UTC для API; '' — если поле пустое. */
export function toUtcIso(date: string, time: string) {
  if (!date || !time) return '';
  // Без пояса в строке Date читает её во времени устройства, с учётом летнего времени.
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

const timeOfDayFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO из API → поля формы: { date: '2026-10-26', time: '19:00' } на устройстве. */
export function localParts(iso: string) {
  const date = new Date(iso);
  return { date: isoDayFormat.format(date), time: timeOfDayFormat.format(date) };
}
