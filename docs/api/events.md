# API: мероприятия, запись, обсуждение, профиль, отзывы (участник 1)

Общие правила и формат ошибок — [../api.md](../api.md). Сущности и правила — [../DATA_MODEL.md](../DATA_MODEL.md). Модули: `sports`, `events`, `registrations`, `comments`, `profiles`.

## Соглашения

- Поля JSON — `camelCase`, как в схеме Drizzle и TypeScript (`startsAt`, `joinMode`). Идентификаторы — UUID строкой.
- Время в API — ISO 8601 в UTC (`2026-10-26T01:00:00.000Z`). Интерфейс показывает его в поясе устройства человека и подписывает пояс: в Москве встреча в 19:00 по Красноярску видна как 15:00 МСК, в Красноярске — как 19:00. Время в форме события тоже вводится в поясе устройства.
- Списки: `{ items: T[], total: number }`, параметры `limit` (1–50, по умолчанию 20) и `offset`, как в [organizations.md](organizations.md).
- **Смотреть можно без входа:** лента, карточка опубликованного события, обсуждение, профиль. Записаться, написать комментарий, создать событие — только после входа (иначе 401).
- Свои коды ошибок — в таблице в конце. Общие (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`) — по [../api.md](../api.md).

> Решения по умолчанию, которые может поменять капитан: просмотр без входа, время в поясе устройства (решение капитана, раньше было по Красноярску), прошедшие события скрыты из ленты, записываться может только роль `user`.

## Общие типы

```ts
type Sport = { id: string; name: string; slug: string; isCustom: boolean };

// Кто показан организатором: организация (если событие от её имени) или автор.
type Organizer =
  | { type: 'organization'; id: string; name: string } // ссылка на /organizations/:id (участник 2)
  | { type: 'user'; id: string; name: string }; // ссылка на /users/:id

// Моя запись на событие; null — не записан или не вошёл.
type MyRegistration = {
  status: 'confirmed' | 'pending' | 'rejected' | 'cancelled';
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
} | null;

type EventListItem = {
  id: string;
  title: string;
  sport: Sport;
  startsAt: string;
  endsAt: string | null;
  address: string;
  venueId: string | null;
  lat: number | null;
  lng: number | null;
  joinMode: 'free' | 'request';
  level: 'any' | 'beginner' | 'amateur' | 'pro';
  capacity: number | null; // null — без ограничения
  participantsCount: number; // записи в статусе confirmed
  freeSlots: number | null; // null — без ограничения
  registrationClosed: boolean; // организатор закрыл запись до начала
  organizer: Organizer;
  myRegistration: MyRegistration;
};

// Компактная метка для карты событий (участник 2): GET /api/events?view=map
type EventMapItem = Pick<
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

type EventDetails = EventListItem & {
  description: string;
  placeNotes: string | null;
  requirements: string | null;
  venue: Venue | null; // форма — в organizations.md (участник 2), раздел 3
  status: 'published' | 'unpublished' | 'deleted';
  moderationReason: string | null; // только при status ≠ published
  isPast: boolean;
  chatUrl: string | null; // только подтверждённым участникам и организатору
  // Имена подтверждённых участников. null — имена скрыты (событие по заявке, а я не участник и не организатор),
  // тогда показываем только participantsCount.
  participants: { id: string; name: string }[] | null;
  // Что можно мне — считает сервер, интерфейс только показывает.
  permissions: {
    isOrganizer: boolean;
    canEdit: boolean;
    canJoin: boolean;
    canCancel: boolean;
    canComment: boolean;
  };
  // Почему нельзя записаться (если canJoin = false): код из таблицы ошибок и текст для кнопки.
  joinBlock: { code: string; message: string } | null;
  // Оценка организатора участниками прошлых встреч (раздел «Отзывы»): человека или клуба.
  organizerRating: OrganizerSummary;
};
```

## Виды спорта (`sports`, задача 1.1)

| Метод | Путь          | Кто | Запрос                                                                                                                                                                                                                                              | Успех                                                                                         | Ошибки |
| ----- | ------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| GET   | `/api/sports` | все | `?q=` — поиск по названию для подсказок; `?withEvents=true` — только виды с предстоящими опубликованными событиями (для чипов в ленте); `?top=6` — шесть видов с наибольшим числом предстоящих встреч, самые популярные первыми (значки на главной) | `{ items: Sport[] }`: сначала стартовый список, потом добавленные пользователями, по алфавиту | 422    |

«Свой вариант» отдельным запросом не создаётся: его присылают в теле создания события полем `sportName`. Сервер нормализует название по DATA_MODEL (пробелы, регистр, `ё`→`е`, знаки препинания), находит существующий вид спорта с тем же `slug` или создаёт новый с `isCustom = true`. Правка кода не нужна, новый вид сразу появляется в `GET /api/sports`.

## Мероприятия (`events`, задачи 1.2–1.5)

| Метод | Путь               | Кто                    | Запрос                                          | Успех                                                                                                                                                                                                                                                                    | Ошибки                                                                                                                          |
| ----- | ------------------ | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| GET   | `/api/events`      | все                    | см. «Фильтры ленты»                             | `{ items: EventListItem[], total }`, только `published`, по возрастанию `startsAt`; при `view=map` — `{ items: EventMapItem[], total }`                                                                                                                                  | 422                                                                                                                             |
| GET   | `/api/events/mine` | `user`, `organization` | `?scope=upcoming` (по умолчанию) или `past`     | `{ items: (EventListItem & { status; moderationReason; pendingCount: number; attendance: AttendanceState \| null })[], total }` — события, которые я организую, включая снятые, со счётчиком ожидающих заявок; у прошедших опубликованных — можно ли отметить участников | 401; 403                                                                                                                        |
| GET   | `/api/events/:id`  | все                    | —                                               | `EventDetails`                                                                                                                                                                                                                                                           | 404 `EVENT_NOT_FOUND`; 404 `EVENT_UNAVAILABLE` — снято или удалено, а я не организатор, не записан и не админ                   |
| POST  | `/api/events`      | `user`, `organization` | `EventInput`                                    | 201 `EventDetails`                                                                                                                                                                                                                                                       | 401; 403; ошибки проверки организации; 422 по полям                                                                             |
| PATCH | `/api/events/:id`  | автор события          | часть полей `EventInput` и `registrationClosed` | `EventDetails`                                                                                                                                                                                                                                                           | 401; 403 `NOT_EVENT_AUTHOR`; 404; 409 `EVENT_UNAVAILABLE`, `EVENT_PAST`, `CAPACITY_BELOW_PARTICIPANTS`, `JOIN_MODE_LOCKED`; 422 |

**Фильтры ленты** (`GET /api/events`), все необязательные:

| Параметр          | Значение                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `q`               | поиск по названию, описанию и виду спорта: полнотекстовый (русская морфология) и по части слова, чтобы «фут» находил «Футбол» |
| `place`           | «Где»: часть адреса, пояснения к месту или названия площадки, без учёта регистра                                              |
| `sportId`         | id вида спорта, можно несколько через запятую                                                                                 |
| `organizationId`  | события организации (её страница у участника 2)                                                                               |
| `date`            | `YYYY-MM-DD` — события одного дня; или диапазон `dateFrom`, `dateTo`. Границы дня — в поясе `tz`                              |
| `tz`              | пояс IANA устройства (`Europe/Moscow`), по умолчанию `Asia/Krasnoyarsk`; смещения вида `+03:00` — 422                         |
| `joinMode`        | `free` / `request`                                                                                                            |
| `level`           | `any` / `beginner` / `amateur` / `pro`                                                                                        |
| `bbox`            | `minLng,minLat,maxLng,maxLat` — только события с точкой внутри области                                                        |
| `includePast`     | `true` — показать и прошедшие; по умолчанию прошедшие скрыты                                                                  |
| `view`            | `list` (по умолчанию) или `map` — компактные метки для карты, `limit` до 500                                                  |
| `limit`, `offset` | см. «Соглашения»                                                                                                              |

**`EventInput`** (создание; при правке те же поля, все необязательные):

| Поле                          | Правила                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `title`                       | 3–100 символов                                                                                              |
| `description`                 | 1–5000 символов                                                                                             |
| `sportId` **или** `sportName` | ровно одно из двух; `sportName` — свой вариант, 2–40 символов                                               |
| `startsAt`                    | в будущем                                                                                                   |
| `endsAt`                      | необязательно, позже `startsAt`                                                                             |
| `address`                     | 3–300 символов. Обязателен, если не выбрана площадка; с площадкой можно не указывать — подставится её адрес |
| `venueId`                     | необязательно; сервер подставляет `lat`, `lng` площадки (и адрес, если он не введён)                        |
| `lat`, `lng`                  | необязательно, только парой; своя точка на карте без площадки                                               |
| `placeNotes`                  | до 300 символов: как найти, вход, этаж                                                                      |
| `joinMode`                    | `free` / `request`                                                                                          |
| `level`                       | по умолчанию `any`                                                                                          |
| `requirements`                | до 2000 символов: подготовка, инвентарь, что взять                                                          |
| `capacity`                    | 1–10000 или `null` — без ограничения                                                                        |
| `chatUrl`                     | ссылка `http(s)://` на внешний чат, необязательно                                                           |

**Создание от имени организации.** Если автор — аккаунт `organization`, сервер вызывает `resolvePublishingOrganization` модуля `organizations` (участник 2) и ставит полученный `organizationId`. Ошибки этой проверки (`ORG_NOT_FOUND`, `ORG_NOT_APPROVED` с причиной отказа) пробрасываются как есть. Поля выбора организатора в запросе нет, `organizationId` из тела не принимается. Событие публикуется сразу (`status = published`).

**Правка** — только автор и только опубликованного предстоящего события. Нельзя уменьшить `capacity` ниже числа подтверждённых участников и нельзя сменить `joinMode`, если есть подтверждённые или ожидающие записи: иначе у людей молча поменялись бы условия.

**Закрыть запись** — `PATCH /api/events/:id` с `{ "registrationClosed": true }`, открыть снова — с `false`. Тоже только автор и только до начала: после начала запись закрыта и без флага. Закрытая запись не принимает новых записей и заявок (409 `REGISTRATION_CLOSED`); уже записанные остаются и могут отменить запись, а ждущие заявки организатор по-прежнему рассматривает. В ленте и на карте событие остаётся, у него `registrationClosed = true`, `permissions.canJoin = false` и `joinBlock` с кодом `REGISTRATION_CLOSED`. При создании запись всегда открыта: в `EventInput` этого поля нет.

**Снятое или удалённое событие** (`status ≠ published`): в ленте его нет. По прямой ссылке организатор, записавшиеся и админ получают `EventDetails` со `status`, `moderationReason` и `permissions.canJoin = false` — интерфейс показывает «Публикация недоступна» и причину. Остальные получают 404 `EVENT_UNAVAILABLE` «Событие недоступно».

## Запись (`registrations`, задача 1.6)

| Метод  | Путь                           | Кто    | Запрос                                                                  | Успех                                                                                                                                                                                                                                                                       | Ошибки                                                                                                                                                |
| ------ | ------------------------------ | ------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/events/:id/registration` | `user` | `{ message?: string }` — до 500 символов, только для режима «по заявке» | 200 `MyRegistration`: `confirmed` при `free`, `pending` при `request`                                                                                                                                                                                                       | 401; 403; 404; 409 `EVENT_UNAVAILABLE`, `EVENT_PAST`, `OWN_EVENT`, `REGISTRATION_CLOSED`, `EVENT_FULL`, `ALREADY_REGISTERED`, `REGISTRATION_REJECTED` |
| DELETE | `/api/events/:id/registration` | `user` | —                                                                       | 200 `MyRegistration` со статусом `cancelled`                                                                                                                                                                                                                                | 401; 404; 409 `NOT_REGISTERED`, `EVENT_PAST`                                                                                                          |
| GET    | `/api/registrations/mine`      | `user` | `?scope=upcoming` (по умолчанию) или `past`                             | `{ items: (EventListItem & { status; moderationReason; review: ReviewState \| null })[], total }`; у каждого заполнен `myRegistration`. Снятые тоже, чтобы человек видел «Публикация недоступна». `review` — только у прошедших встреч, где я был подтверждённым участником | 401; 403                                                                                                                                              |

- Повторная запись после отмены меняет статус той же строки (`cancelled` → `confirmed` / `pending`), новой записи не создаёт. После отказа (`rejected`) записаться снова нельзя.
- Проверка мест и запись идут в одной транзакции с `SELECT … FOR UPDATE` на строке события: два человека не займут последнее место.
- Записи на снятое событие не удаляются и статус не меняют (DATA_MODEL).

### Сервис для панели организатора (участник 2, задача 2.7)

Панель вызывает функции модуля напрямую, а не HTTP и не свой SQL. Сигнатуры — как просил участник 2 в [organizations.md](organizations.md), раздел 2. Файл: `apps/api/src/modules/registrations/service.ts`.

```ts
type OrganizerRegistration = {
  id: string;
  status: 'confirmed' | 'pending' | 'rejected' | 'cancelled';
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    about: string | null;
    reliability: ParticipantSummary; // надёжность по прошлым встречам, раздел «Отзывы»
  };
};

/** Записи события для его автора: сначала pending, затем новее. */
listRegistrationsForAuthor(
  db: Db,
  args: { eventId: string; actorId: string; status?: RegistrationStatus },
): Promise<{
  items: OrganizerRegistration[];
  counts: Record<RegistrationStatus, number>;
  capacity: number | null;
}>;

/** Принять или отклонить заявку. */
decideRegistration(
  db: Db,
  args: { eventId: string; registrationId: string; actorId: string; decision: 'confirm' | 'reject' },
): Promise<OrganizerRegistration>;
```

Правила (ошибки — `AppError`, панель их просто пробрасывает):

- нет события или записи в этом событии: 404 `EVENT_NOT_FOUND` / `REGISTRATION_NOT_FOUND`;
- решает только автор события (`created_by`); у события организации это её представитель. Админ не решает: 403 `NOT_EVENT_AUTHOR`;
- только из `pending`: иначе 409 `NOT_PENDING`;
- событие опубликовано и не прошло: иначе 409 `EVENT_UNAVAILABLE` / `EVENT_PAST`;
- принятие учитывает лимит мест в той же транзакции с блокировкой строки события: 409 `EVENT_FULL`;
- записывает `decidedBy`, `decidedAt`; пользователь видит новый статус в карточке и в «Моих мероприятиях».

## Обсуждение (`comments`, задача 1.8)

| Метод | Путь                       | Кто                    | Запрос                                | Успех                                                                      | Ошибки                                                                              |
| ----- | -------------------------- | ---------------------- | ------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET   | `/api/events/:id/comments` | все, кто видит событие | —                                     | `{ items: Comment[] }`: корневые по времени, в каждом `replies` по времени | 404 — как у карточки                                                                |
| POST  | `/api/events/:id/comments` | вошедший               | `{ text: string; parentId?: string }` | 201 `Comment`                                                              | 401; 404; 409 `EVENT_UNAVAILABLE`; 422 — пустой или длинный текст, чужой `parentId` |

```ts
type Comment = {
  id: string;
  parentId: string | null;
  author: {
    id: string;
    name: string;
    // Плашка роли: автор события — «Организатор» (или название организации), админ — «Модератор».
    badge: 'organizer' | 'moderator' | null;
    badgeLabel: string | null;
  };
  text: string | null; // null, если скрыт модератором: интерфейс пишет «Сообщение скрыто модератором»
  isHidden: boolean;
  createdAt: string;
  replies: Comment[]; // только у корневых, у ответов пустой массив
};
```

- Текст 1–1000 символов. Глубина ответов — 1: ответ на ответ сервер прикрепляет к корневому комментарию.
- Писать может любой вошедший, в том числе не записанный (ТЗ). Под снятым или удалённым событием писать нельзя.
- Скрытие комментария — модуль `admin` (участник 3, задача 3.6), здесь только показ заглушки.

## Профиль (`profiles`, задача 1.9)

| Метод | Путь             | Кто      | Запрос                                          | Успех                                                                                                                                                                                       | Ошибки               |
| ----- | ---------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| GET   | `/api/users/:id` | все      | —                                               | `{ id, name, about, city, memberSince, sports: Sport[], upcomingEvents: EventListItem[] }` — `memberSince` — дата регистрации (ISO), `upcomingEvents` — события, которые человек организует | 404 `USER_NOT_FOUND` |
| GET   | `/api/users/me`  | вошедший | —                                               | свой профиль, как в `GET /api/users/:id` (для формы правки)                                                                                                                                 | 401                  |
| PATCH | `/api/users/me`  | вошедший | `{ name?, about?, city?, sportIds?: string[] }` | профиль как в `GET /api/users/:id`                                                                                                                                                          | 401; 422             |

Email и пароль здесь не меняются (вход — модуль `auth`, участник 3).

## Отзывы (`reviews`)

Правила — [DATA_MODEL.md](../DATA_MODEL.md), раздел «Review». Схемы и типы — `packages/shared/src/schemas/reviews.ts`.

| Метод | Путь                             | Кто           | Запрос                                                                          | Успех                                                | Ошибки                                                                                                        |
| ----- | -------------------------------- | ------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| PUT   | `/api/events/:id/review`         | `user`        | `{ rating: 1..5, tags?: OrganizerTag[], comment?: string }`                     | 200 `MyReview`; повторный запрос правит тот же отзыв | 401; 403 `NOT_PARTICIPANT`, `OWN_EVENT`; 404; 409 `EVENT_UNAVAILABLE`, `REVIEW_NOT_YET`, `REVIEW_CLOSED`; 422 |
| GET   | `/api/events/:id/attendance`     | автор события | —                                                                               | `Attendance`: подтверждённые участники с отметками   | 401; 403 `NOT_EVENT_AUTHOR`; 404                                                                              |
| PUT   | `/api/events/:id/attendance`     | автор события | `{ marks: { userId, attended, rating?, tags?: ParticipantTag[], comment? }[] }` | 200 `Attendance`                                     | 401; 403 `NOT_EVENT_AUTHOR`; 404; 409 как у отзыва; 422 `NOT_PARTICIPANT` — отмечен не участник встречи       |
| GET   | `/api/users/:id/reviews`         | все           | —                                                                               | `UserReviews`                                        | 404 `USER_NOT_FOUND`                                                                                          |
| GET   | `/api/organizations/:id/reviews` | все           | —                                                                               | `OrganizationReviews`                                | 404 `ORG_NOT_FOUND` — нет или не допущена                                                                     |

```ts
type RatingSummary = { rating: number | null; count: number }; // rating null, пока отзывов меньше трёх
type OrganizerSummary = RatingSummary & { organized: number }; // проведённые встречи
type ParticipantSummary = RatingSummary & { attended: number; total: number }; // «приходит на attended из total»

type Review = {
  id: string;
  direction: 'participant_to_organizer' | 'organizer_to_participant';
  rating: number | null;
  tags: ReviewTag[];
  comment: string | null;
  attended: boolean | null; // только у отметки организатора
  createdAt: string;
  author: { type: 'user' | 'organization'; id: string; name: string }; // за клуб — его название
  event: { id: string; title: string; startsAt: string };
};

type UserReviews = {
  asOrganizer: OrganizerSummary;
  asParticipant: ParticipantSummary;
  items: Review[];
};
type OrganizationReviews = { summary: OrganizerSummary; items: Review[] };

type MyReview = { rating: number; tags: OrganizerTag[]; comment: string | null; updatedAt: string };
type ReviewState = { open: boolean; closesAt: string; mine: MyReview | null }; // в «Моих записях»
type AttendanceState = { open: boolean; closesAt: string; marked: boolean }; // в «Я организую»
type Attendance = {
  open: boolean;
  closesAt: string;
  items: {
    user: { id: string; name: string };
    marked: boolean; // ещё не отмечен — считается пришедшим
    attended: boolean;
    rating: number | null;
    tags: ParticipantTag[];
    comment: string | null;
  }[];
};
```

- В списках только видимые отзывы (слепые отзывы, DATA_MODEL) со звёздами, тегами или текстом; голая отметка «пришёл» в список не попадает, но входит в надёжность. Не больше 50 последних.
- У неявки звёзды и теги сервер отбрасывает, комментарий остаётся.

## Коды ошибок модулей

| `code`                                                 | HTTP            | Сообщение для человека                                                                                  |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------- |
| `EVENT_NOT_FOUND`                                      | 404             | «Событие не найдено»                                                                                    |
| `EVENT_UNAVAILABLE`                                    | 404 / 409       | «Событие недоступно» (не видно) / «Публикация недоступна, записаться нельзя»                            |
| `EVENT_PAST`                                           | 409             | «Событие уже прошло»                                                                                    |
| `OWN_EVENT`                                            | 409             | «Это ваше событие: вы его организатор»                                                                  |
| `EVENT_FULL`                                           | 409             | «Свободных мест нет»                                                                                    |
| `REGISTRATION_CLOSED`                                  | 409             | «Организатор закрыл запись»                                                                             |
| `ALREADY_REGISTERED`                                   | 409             | «Вы уже записаны» / «Заявка уже отправлена»                                                             |
| `REGISTRATION_REJECTED`                                | 409             | «Организатор отклонил вашу заявку»                                                                      |
| `NOT_REGISTERED`                                       | 409             | «Вы не записаны на это событие»                                                                         |
| `REGISTRATION_NOT_FOUND`                               | 404             | «Заявка не найдена»                                                                                     |
| `NOT_PENDING`                                          | 409             | «Заявка уже рассмотрена»                                                                                |
| `NOT_EVENT_AUTHOR`                                     | 403             | «Это может сделать только организатор события»                                                          |
| `CAPACITY_BELOW_PARTICIPANTS`                          | 409             | «Уже записано больше людей, чем новый лимит»                                                            |
| `JOIN_MODE_LOCKED`                                     | 409             | «Режим записи нельзя менять, когда уже есть записи»                                                     |
| `USER_NOT_FOUND`                                       | 404             | «Пользователь не найден»                                                                                |
| `NOT_PARTICIPANT`                                      | 403 / 422       | «Оценить встречу могут только её участники» / «Отметить можно только подтверждённых участников встречи» |
| `REVIEW_NOT_YET`                                       | 409             | «Оценить встречу можно после её окончания»                                                              |
| `REVIEW_CLOSED`                                        | 409             | «Отзыв оставляют в течение 14 дней после встречи»                                                       |
| `OWN_EVENT` (отзывы)                                   | 403             | «Свою встречу оценить нельзя»                                                                           |
| `ORG_NOT_FOUND`, `ORG_NOT_APPROVED`, `VENUE_NOT_FOUND` | 404 / 403 / 422 | коды и тексты модулей участника 2                                                                       |

## Страницы интерфейса зоны

`/` — лента и карта, `/events/:id` — карточка, `/events/new` — создание, `/events/:id/edit` — правка, `/me/events` — «Мои мероприятия» (в «Прошедших» — окна «Оцените встречу» и «Кто пришёл на встречу?»), `/users/:id` — профиль с вкладкой «Отзывы». Страница организации `/organizations/:id` — у участника 2.
