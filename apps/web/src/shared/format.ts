// Даты для интерфейса: в поясе устройства, как и время мероприятий (modules/user/format.ts).

const dateTime = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «22 октября, 19:00» */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
/** «22 октября 2026 г.» */
export const formatDate = (iso: string) => date.format(new Date(iso));
