# API: мероприятия, запись, обсуждение, профиль (участник 1)

Общие правила и формат ошибок — [../api.md](../api.md). Сущности и правила — [../DATA_MODEL.md](../DATA_MODEL.md). Модули: `sports`, `events`, `registrations`, `comments`, `profiles`.

## Соглашения

- Поля JSON — `camelCase`, как в схеме Drizzle и TypeScript (`startsAt`, `joinMode`). Идентификаторы — UUID строкой.
- Время в API — ISO 8601 в UTC (`2026-10-26T01:00:00.000Z`). Интерфейс показывает его в поясе города демо-данных `Asia/Krasnoyarsk` с подписью «по местному времени», а не в поясе браузера: эксперт из Москвы должен видеть то же время, что и организатор.
- Списки: `{ items: T[], total: number }`, параметры `page` (с 1) и `pageSize` (по умолчанию 20, максимум 50).
- **Смотреть можно без входа:** лента, карточка опубликованного события, обсуждение, профиль. Записаться, написать комментарий, создать событие — только после входа (иначе 401).
- Свои коды ошибок — в таблице в конце. Общие (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`) — по [../api.md](../api.md).

> Решения по умолчанию, которые может поменять капитан: просмотр без входа, время по Красноярску, прошедшие события скрыты из ленты, запись только для роли `user`.

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
  lat: number | null;
  lng: number | null;
  joinMode: 'free' | 'request';
  level: 'any' | 'beginner' | 'amateur' | 'pro';
  capacity: number | null; // null — без ограничения
  participantsCount: number; // записи в статусе confirmed
  freeSlots: number | null; // null — без ограничения
  organizer: Organizer;
  myRegistration: MyRegistration;
};

type EventDetails = EventListItem & {
  description: string;
  placeNotes: string | null;
  requirements: string | null;
  venueId: string | null;
  venue: VenueCard | null; // форма — в api/organizations.md (участник 2)
  status: 'published' | 'unpublished' | 'deleted';
  moderationReason: string | null; // только при status ≠ published
  isPast: boolean;
  chatUrl: string | null; // только подтверждённым участникам и организатору
  // Имена подтверждённых участников. null — имена скрыты (событие по заявке, а я не участник и не организатор),
  // тогда показываем только participantsCount.
  participants: { id: string; name: string }[] | null;
  // Что можно мне — считает сервер, интерфейс только показывает.
  permissions: {
    canEdit: boolean;
    canJoin: boolean;
    canCancel: boolean;
    canComment: boolean;
    isOrganizer: boolean;
  };
  joinUnavailableReason: string | null; // текст для кнопки, если canJoin = false: «Мест нет», «Событие прошло»
};
```

## Виды спорта (`sports`, задача 1.1)

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/sports` | все | `?q=` — поиск по названию для подсказок; `?withEvents=true` — только виды с предстоящими опубликованными событиями (для чипов в ленте) | `{ items: Sport[] }`: сначала стартовый список, потом добавленные пользователями, по алфавиту | — |

«Свой вариант» отдельным запросом не создаётся: его присылают в теле создания события полем `sportName`. Сервер нормализует название по DATA_MODEL (пробелы, регистр, `ё`→`е`), находит существующий вид спорта с тем же `slug` или создаёт новый с `isCustom = true`. Правка кода не нужна, новый вид сразу появляется в `GET /api/sports`.

## Мероприятия (`events`, задачи 1.2–1.5)

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/events` | все | см. «Фильтры ленты» | `{ items: EventListItem[], total }`, только `published`, по возрастанию `startsAt` | 422 — неверный фильтр |
| GET | `/api/events/:id` | все | — | `EventDetails` | 404 `EVENT_UNAVAILABLE` — снято или удалено, а я не организатор, не записан и не админ; 404 `NOT_FOUND` — нет такого |
| POST | `/api/events` | `user`, `organization` | `EventInput` | 201 `EventDetails` | 401; 403 — админ; 403 `ORG_NOT_APPROVED`; 422 по полям |
| PATCH | `/api/events/:id` | автор события | часть полей `EventInput` | `EventDetails` | 403 — не автор; 409 `EVENT_UNAVAILABLE`; 409 `EVENT_PAST`; 409 `CAPACITY_BELOW_PARTICIPANTS`; 409 `JOIN_MODE_LOCKED`; 422 |

**Фильтры ленты** (`GET /api/events`), все необязательные:

| Параметр | Значение |
| --- | --- |
| `q` | поиск по названию и описанию: полнотекстовый (русская морфология), плюс совпадение по началу слова, чтобы «фут» находил «Футбол» |
| `sport` | id вида спорта, можно несколько через запятую |
| `dateFrom`, `dateTo` | `YYYY-MM-DD`, границы дня — по Красноярску |
| `joinMode` | `free` / `request` |
| `level` | `any` / `beginner` / `amateur` / `pro` |
| `bbox` | `minLng,minLat,maxLng,maxLat` — только события с точкой внутри области (для карты участника 2) |
| `includePast` | `true` — показать и прошедшие; по умолчанию прошедшие скрыты |
| `page`, `pageSize` | см. «Соглашения» |

**`EventInput`** (создание; при правке те же поля, все необязательные):

| Поле | Правила |
| --- | --- |
| `title` | 3–100 символов |
| `description` | 1–5000 символов |
| `sportId` **или** `sportName` | ровно одно из двух; `sportName` — свой вариант, 2–40 символов |
| `startsAt` | в будущем |
| `endsAt` | необязательно, позже `startsAt` |
| `address` | 3–300 символов; обязателен всегда, даже если выбрана площадка |
| `venueId` | необязательно; площадку проверяет модуль `venues` (участник 2), сервер подставляет её `lat`/`lng`, адрес можно поправить |
| `lat`, `lng` | необязательно, только парой; своя точка на карте |
| `placeNotes` | до 300 символов: как найти, вход, этаж |
| `joinMode` | `free` / `request` |
| `level` | по умолчанию `any` |
| `requirements` | до 2000 символов: подготовка, инвентарь, что взять |
| `capacity` | 1–10000 или `null` — без ограничения |
| `chatUrl` | ссылка `http(s)://` на внешний чат, необязательно |

**Создание от имени организации.** Если автор — аккаунт `organization`, сервер сам ставит `organizationId` его организации и вызывает проверку модуля `organizations` (участник 2): организация есть и `approved`. Иначе 403 `ORG_NOT_APPROVED`. Поля выбора организатора в запросе нет. Событие публикуется сразу (`status = published`).

**Правка** — только автор и только опубликованного предстоящего события. Нельзя уменьшить `capacity` ниже числа подтверждённых участников и нельзя сменить `joinMode`, если есть подтверждённые или ожидающие записи: иначе у людей молча поменялись бы условия.

**Снятое или удалённое событие** (`status ≠ published`): в ленте его нет. По прямой ссылке организатор, записавшиеся и админ получают `EventDetails` со `status`, `moderationReason` и `permissions.canJoin = false` — интерфейс показывает «Публикация недоступна» и причину. Остальные получают 404 `EVENT_UNAVAILABLE` «Событие недоступно».

## Запись (`registrations`, задача 1.6)

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/events/:id/registration` | `user` | `{ message?: string }` — до 500 символов, только для режима «по заявке» | 200 `MyRegistration`: `confirmed` при `free`, `pending` при `request` | 401; 403 — не `user`; 404; 409 `EVENT_UNAVAILABLE`, `EVENT_PAST`, `OWN_EVENT`, `EVENT_FULL`, `ALREADY_REGISTERED`, `REGISTRATION_REJECTED` |
| DELETE | `/api/events/:id/registration` | `user` | — | 200 `MyRegistration` со статусом `cancelled` | 401; 404; 409 `NOT_REGISTERED`, `EVENT_PAST` |
| GET | `/api/me/registrations` | вошедший | `?scope=upcoming` (по умолчанию) или `past` | `{ items: (EventListItem & { myRegistration: NonNullable<MyRegistration>; status; moderationReason })[], total }` — включая снятые, чтобы человек видел «Публикация недоступна» | 401 |

- Повторная запись после отмены меняет статус той же строки (`cancelled` → `confirmed` / `pending`), новой записи не создаёт. После отказа (`rejected`) записаться снова нельзя.
- Проверка мест и запись идут в одной транзакции с `SELECT … FOR UPDATE` на строке события: два человека не займут последнее место.
- Записи на снятое событие не удаляются и статус не меняют (DATA_MODEL).

### Сервис для панели организатора (участник 2, задача 2.7)

Панель вызывает функции модуля напрямую, а не HTTP и не свой SQL. Файл: `apps/api/src/modules/registrations/service.ts`.

```ts
type OrganizerRegistration = {
  id: string;
  status: 'confirmed' | 'pending' | 'rejected' | 'cancelled';
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: { id: string; name: string };
};

/** Все записи события для его автора: подтверждённые, ожидающие, отклонённые, отменённые. */
listForOrganizer(eventId: string, actor: SessionUser): Promise<OrganizerRegistration[]>;

/** Принять или отклонить заявку. */
decide(
  registrationId: string,
  decision: 'confirm' | 'reject',
  actor: SessionUser,
): Promise<OrganizerRegistration>;
```

Правила `decide` (ошибки — `AppError`, панель их просто пробрасывает):
- решает только автор события (`created_by`); у события организации это её представитель. Админ не решает: 403 `NOT_EVENT_AUTHOR`;
- только из `pending`: иначе 409 `NOT_PENDING`;
- событие опубликовано и не прошло: иначе 409 `EVENT_UNAVAILABLE` / `EVENT_PAST`;
- принятие учитывает лимит мест в той же транзакции с блокировкой строки события: 409 `EVENT_FULL`;
- записывает `decidedBy`, `decidedAt`; пользователь видит новый статус в карточке и в «Моих мероприятиях».

## Обсуждение (`comments`, задача 1.8)

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/events/:id/comments` | все, кто видит событие | — | `{ items: Comment[] }`: корневые по времени, в каждом `replies` по времени | 404 / 404 `EVENT_UNAVAILABLE` — как у карточки |
| POST | `/api/events/:id/comments` | вошедший | `{ text: string; parentId?: string }` | 201 `Comment` | 401; 409 `EVENT_UNAVAILABLE`; 422 — пустой или длинный текст, чужой `parentId` |

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

## Профиль и «Мои мероприятия» (`profiles`, задачи 1.7, 1.9)

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/users/:id` | все | — | `{ id, name, about, city, sports: Sport[], upcomingEvents: EventListItem[] }` — события, которые человек организует | 404 |
| PATCH | `/api/me/profile` | вошедший | `{ name?, about?, city?, sportIds?: string[] }` | профиль как в `GET /api/users/:id` | 401; 422 |
| GET | `/api/me/events` | вошедший | `?scope=upcoming` (по умолчанию) или `past` | `{ items: (EventListItem & { status; moderationReason; pendingCount: number })[], total }` — события, которые я организую, со счётчиком ожидающих заявок | 401 |

Email и пароль здесь не меняются (вход — модуль `auth`, участник 3).

## Коды ошибок модулей

| `code` | HTTP | Сообщение для человека |
| --- | --- | --- |
| `EVENT_UNAVAILABLE` | 404 / 409 | «Событие недоступно» (не видно) / «Публикация недоступна, записаться нельзя» |
| `EVENT_PAST` | 409 | «Событие уже прошло» |
| `OWN_EVENT` | 409 | «Это ваше событие: вы его организатор» |
| `EVENT_FULL` | 409 | «Свободных мест нет» |
| `ALREADY_REGISTERED` | 409 | «Вы уже записаны» / «Заявка уже отправлена» |
| `REGISTRATION_REJECTED` | 409 | «Организатор отклонил вашу заявку» |
| `NOT_REGISTERED` | 409 | «Вы не записаны на это событие» |
| `NOT_PENDING` | 409 | «Заявка уже рассмотрена» |
| `NOT_EVENT_AUTHOR` | 403 | «Заявки рассматривает только организатор события» |
| `CAPACITY_BELOW_PARTICIPANTS` | 409 | «Уже записано больше людей, чем новый лимит» |
| `JOIN_MODE_LOCKED` | 409 | «Режим записи нельзя менять, когда уже есть записи» |
| `ORG_NOT_APPROVED` | 403 | код и текст — модуля `organizations` (участник 2) |

## Страницы интерфейса зоны

`/` — лента и карта, `/events/:id` — карточка, `/events/new` — создание, `/events/:id/edit` — правка, `/me/events` — «Мои мероприятия», `/users/:id` — профиль. Страница организации `/organizations/:id` — у участника 2.
