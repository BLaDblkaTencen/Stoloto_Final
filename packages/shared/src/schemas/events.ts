// Мероприятия: проверка запросов и типы ответов API. Владелец: участник 1.
// Контракт — docs/api/events.md. Сервер проверяет этими схемами тело и параметры запросов,
// интерфейс — формы, поэтому тексты ошибок здесь сразу для человека.
import { z } from 'zod';
import {
  EVENT_LEVELS,
  JOIN_MODES,
  type EventLevel,
  type EventStatus,
  type JoinMode,
  type RegistrationStatus,
  type VenueType,
} from '../enums';
import { sportNameSchema, type Sport } from './sports';
import type { AttendanceState, OrganizerSummary } from './reviews';

/**
 * Часовой пояс, в котором показываем время и считаем границы дня в фильтре по дате.
 * Не пояс браузера: эксперт из Москвы должен видеть то же время встречи, что и организатор.
 */
export const EVENT_TIMEZONE = 'Asia/Krasnoyarsk';

/** Лимиты текстовых полей, общие для формы и сервера. */
export const EVENT_LIMITS = {
  title: { min: 3, max: 100 },
  description: { max: 5000 },
  address: { min: 3, max: 300 },
  placeNotes: { max: 300 },
  requirements: { max: 2000 },
  capacity: { min: 1, max: 10000 },
} as const;

const LIST_LIMIT_MAX = 50;
const MAP_LIMIT_MAX = 500;

const dateTime = (message: string) =>
  z.iso.datetime({ offset: true, error: message }).transform((value) => new Date(value));

/** Необязательный текст: пустая строка из формы превращается в null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

// Поля без перекрёстных проверок: из них собраны схемы создания и правки.
const eventFields = z.object({
  title: z
    .string({ error: 'Укажите название' })
    .trim()
    .min(1, 'Укажите название')
    .min(EVENT_LIMITS.title.min, `Название — не короче ${EVENT_LIMITS.title.min} символов`)
    .max(EVENT_LIMITS.title.max, `Название — не длиннее ${EVENT_LIMITS.title.max} символов`),
  description: z
    .string({ error: 'Расскажите, что будет на встрече' })
    .trim()
    .min(1, 'Расскажите, что будет на встрече')
    .max(
      EVENT_LIMITS.description.max,
      `Описание — не длиннее ${EVENT_LIMITS.description.max} символов`,
    ),
  sportId: z.uuid('Выберите вид спорта из списка').optional(),
  sportName: sportNameSchema.optional(),
  startsAt: dateTime('Укажите дату и время начала'),
  endsAt: dateTime('Неверное время окончания').nullable().optional(),
  address: z
    .string()
    .trim()
    .min(1, 'Укажите адрес или место')
    .min(EVENT_LIMITS.address.min, `Адрес — не короче ${EVENT_LIMITS.address.min} символов`)
    .max(EVENT_LIMITS.address.max, `Адрес — не длиннее ${EVENT_LIMITS.address.max} символов`)
    .optional(),
  venueId: z.uuid('Площадка не найдена').nullable().optional(),
  lat: z
    .number('Неверная точка на карте')
    .min(-90, 'Неверная точка на карте')
    .max(90, 'Неверная точка на карте')
    .nullable()
    .optional(),
  lng: z
    .number('Неверная точка на карте')
    .min(-180, 'Неверная точка на карте')
    .max(180, 'Неверная точка на карте')
    .nullable()
    .optional(),
  placeNotes: optionalText(
    EVENT_LIMITS.placeNotes.max,
    `Подсказка к месту — не длиннее ${EVENT_LIMITS.placeNotes.max} символов`,
  ),
  joinMode: z.enum(JOIN_MODES, 'Выберите режим записи'),
  // Без .default(): в схеме правки он подставил бы «any» и молча сбросил уровень. По умолчанию — в сервисе.
  level: z.enum(EVENT_LEVELS, 'Выберите уровень подготовки').optional(),
  requirements: optionalText(
    EVENT_LIMITS.requirements.max,
    `Условия — не длиннее ${EVENT_LIMITS.requirements.max} символов`,
  ),
  capacity: z
    .number('Лимит мест — число')
    .int('Лимит мест — целое число')
    .min(EVENT_LIMITS.capacity.min, 'Лимит — хотя бы одно место')
    .max(EVENT_LIMITS.capacity.max, `Лимит — не больше ${EVENT_LIMITS.capacity.max} мест`)
    .nullable()
    .optional(),
  chatUrl: z.preprocess(
    (value) => (value === '' ? null : value),
    z
      .url({ protocol: /^https?$/, error: 'Ссылка должна начинаться с http:// или https://' })
      .nullable()
      .optional(),
  ),
});

type EventFields = Partial<z.output<typeof eventFields>>;

/** Своя точка на карте задаётся только парой координат. */
function checkPoint(value: EventFields, ctx: z.RefinementCtx) {
  const latGiven = value.lat !== undefined;
  const lngGiven = value.lng !== undefined;
  if (latGiven !== lngGiven || (latGiven && (value.lat === null) !== (value.lng === null))) {
    ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Отметьте точку на карте заново' });
  }
}

export const createEventSchema = eventFields.superRefine((value, ctx) => {
  if (!value.sportId === !value.sportName) {
    ctx.addIssue({
      code: 'custom',
      path: ['sportId'],
      message: 'Выберите вид спорта из списка или впишите свой',
    });
  }
  if (!value.address && !value.venueId) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message: 'Укажите адрес или выберите площадку на карте',
    });
  }
  if (value.endsAt && value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'Окончание должно быть позже начала',
    });
  }
  checkPoint(value, ctx);
});

/**
 * Правка: любые поля создания, все необязательные. Связь начала и окончания проверяет сервер.
 * registrationClosed — только здесь: при создании запись всегда открыта.
 */
export const updateEventSchema = eventFields
  .partial()
  .extend({ registrationClosed: z.boolean('Запись: открыта или закрыта').optional() })
  .superRefine((value, ctx) => {
    if (value.sportId && value.sportName) {
      ctx.addIssue({
        code: 'custom',
        path: ['sportId'],
        message: 'Выберите вид спорта из списка или впишите свой',
      });
    }
    checkPoint(value, ctx);
  });

/** Тело формы, как его отправляет интерфейс. */
export type EventInput = z.input<typeof createEventSchema>;
export type CreateEventData = z.output<typeof createEventSchema>;
export type UpdateEventData = z.output<typeof updateEventSchema>;

const idList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.uuid('Неверный вид спорта')).max(20, 'Слишком много видов спорта'));

const bbox = z
  .string()
  .transform((value) => value.split(',').map(Number))
  .pipe(
    z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
  )
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng <= maxLng && minLat <= maxLat, {
    message: 'Неверная область карты',
  })
  .transform(([minLng, minLat, maxLng, maxLat]) => ({ minLng, minLat, maxLng, maxLat }));

const day = z.iso.date('Дата в формате ГГГГ-ММ-ДД');

export const eventListQuerySchema = z
  .object({
    q: z.string().trim().max(100, 'Слишком длинный запрос').optional(),
    /** «Где»: часть адреса, пояснения к месту или названия площадки. */
    place: z.string().trim().max(100, 'Слишком длинный запрос').optional(),
    sportId: idList.optional(),
    organizationId: z.uuid('Неверная организация').optional(),
    /** Один день; то же, что dateFrom = dateTo. */
    date: day.optional(),
    dateFrom: day.optional(),
    dateTo: day.optional(),
    joinMode: z.enum(JOIN_MODES).optional(),
    level: z.enum(EVENT_LEVELS).optional(),
    bbox: bbox.optional(),
    includePast: z.stringbool().default(false),
    view: z.enum(['list', 'map']).default('list'),
    limit: z.coerce.number().int().min(1).max(MAP_LIMIT_MAX).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.view === 'list' && value.limit > LIST_LIMIT_MAX) {
      ctx.addIssue({
        code: 'custom',
        path: ['limit'],
        message: `В списке — не больше ${LIST_LIMIT_MAX}`,
      });
    }
  })
  .transform(({ date, ...rest }) => ({
    ...rest,
    dateFrom: rest.dateFrom ?? date,
    dateTo: rest.dateTo ?? date,
  }));

export type EventListQuery = z.output<typeof eventListQuerySchema>;

export const myEventsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MyEventsQuery = z.output<typeof myEventsQuerySchema>;

// ---------- Ответы ----------

/** Кто показан организатором: организация, если событие от её имени, иначе автор. */
export type Organizer =
  { type: 'organization'; id: string; name: string } | { type: 'user'; id: string; name: string };

/** Моя запись на событие; null — не записан или не вошёл. */
export type MyRegistration = {
  status: RegistrationStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
} | null;

export type EventListItem = {
  id: string;
  title: string;
  sport: Sport;
  startsAt: string;
  endsAt: string | null;
  address: string;
  venueId: string | null;
  lat: number | null;
  lng: number | null;
  joinMode: JoinMode;
  level: EventLevel;
  /** null — без ограничения. */
  capacity: number | null;
  /** Записи в статусе confirmed. */
  participantsCount: number;
  /** null — без ограничения. */
  freeSlots: number | null;
  /** Организатор закрыл запись до начала встречи; после начала запись закрыта и так. */
  registrationClosed: boolean;
  organizer: Organizer;
  myRegistration: MyRegistration;
};

/** Компактная метка для карты событий: GET /api/events?view=map. */
export type EventMapItem = Pick<
  EventListItem,
  | 'id'
  | 'title'
  | 'startsAt'
  | 'joinMode'
  | 'lat'
  | 'lng'
  | 'venueId'
  | 'participantsCount'
  | 'capacity'
> & { sportId: string };

/** Площадка в карточке события. Форма — Venue участника 2 (docs/api/organizations.md, раздел 3). */
export type EventVenue = {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  workingHours: string | null;
  contact: { name: string | null; phone: string | null; note: string | null } | null;
};

export type EventPermissions = {
  isOrganizer: boolean;
  canEdit: boolean;
  canJoin: boolean;
  canCancel: boolean;
  canComment: boolean;
};

/** Почему нельзя записаться: код из docs/api/events.md и текст для кнопки. */
export type JoinBlock = { code: string; message: string };

export type EventDetails = EventListItem & {
  description: string;
  placeNotes: string | null;
  requirements: string | null;
  venue: EventVenue | null;
  status: EventStatus;
  /** Только у снятого или удалённого события. */
  moderationReason: string | null;
  isPast: boolean;
  /** Только подтверждённым участникам и организатору. */
  chatUrl: string | null;
  /** null — имена скрыты (событие по заявке), показываем только participantsCount. */
  participants: { id: string; name: string }[] | null;
  permissions: EventPermissions;
  joinBlock: JoinBlock | null;
  /** Оценка организатора участниками прошлых встреч: человека или клуба. */
  organizerRating: OrganizerSummary;
};

/** Событие в «Моих мероприятиях» организатора. */
export type MyEventItem = EventListItem & {
  status: EventStatus;
  moderationReason: string | null;
  pendingCount: number;
  /** Только у прошедших опубликованных: отметить, кто пришёл. */
  attendance: AttendanceState | null;
};

export type ListResponse<T> = { items: T[]; total: number };
