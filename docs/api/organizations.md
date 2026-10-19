# Контракт API: организации, панель организатора, площадки

Зона участника 2. Модели и статусы — [DATA_MODEL.md](../DATA_MODEL.md), таблицы — [DB_SCHEMA.md](../DB_SCHEMA.md). Общий индекс контракта — [api.md](../api.md). Меняешь контракт — меняешь этот файл в том же PR.
Схемы Zod будут лежать в `packages/shared/src/organizations.ts` и `venues.ts` (после появления каркаса), код — в `apps/api/src/modules/{organizations,organizer-panel,venues}`.

## Общие соглашения (предложение для всего API)

- Префикс `/api`, JSON в UTF-8. Идентификаторы — строки (UUID). Время — ISO 8601, UTC.
- Сессия — `HttpOnly`-cookie (вход делает участник 3). Роль берётся из сессии на сервере, из тела запроса никогда.
- Ошибка всегда одного вида:
  ```json
  { "error": { "code": "ORG_NOT_APPROVED", "message": "Организация ещё не допущена администратором", "fields": { "name": "Слишком короткое название" } } }
  ```
  `message` — готовый русский текст для показа человеку; `fields` — только для 422.
- Коды HTTP: 400 неверный запрос, 401 нет входа, 403 нет прав, 404 не найдено, 409 конфликт состояния, 422 ошибка проверки полей.
- Списки с пагинацией: `limit` (1–100, по умолчанию 20) и `offset`; ответ `{ "items": [], "total": 0 }`.

## Права доступа

| Действие | Аноним | user | organization | admin |
| --- | --- | --- | --- | --- |
| Список и страница допущенных организаций | да | да | да | да |
| Страница не допущенной организации | нет (404) | нет (404) | только своя | да (чтение) |
| Создать организацию, править профиль, подать повторно | нет | нет | да, одну свою | нет |
| Решение по заявке организации | нет | нет | нет | да (модуль admin, участник 3) |
| Панель организатора: список записей и решения | нет | автор события | автор события | нет |
| Площадки и типы площадок (чтение) | да | да | да | да |

Администратор заявки **участников** не рассматривает (ТЗ). Это закреплено и в базе: решить запись может только автор события.

---

## 1. Организации

### Формы данных

```ts
type OrganizationStatus = 'pending' | 'approved' | 'rejected';

type SportRef = { id: string; name: string; slug: string };

// Публичный вид (допущенная организация)
type OrganizationPublic = {
  id: string;
  name: string;            // 2–100 символов
  description: string;     // чем занимается, 10–1000
  activity: string;        // вид объединения: клуб, кружок, федерация… 2–100
  city: string | null;     // до 80
  contacts: string | null; // до 300; публичные контакты
  sports: SportRef[];      // спортивные интересы, минимум один
  createdAt: string;
};

// Вид для владельца и админа
type OrganizationOwner = OrganizationPublic & {
  ownerId: string;
  status: OrganizationStatus;
  rejectionReason: string | null; // есть только при rejected
  reviewedAt: string | null;
};
```

### Эндпоинты

| Метод и путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| `POST /api/organizations` | `organization`, у которой ещё нет организации | `{ name, description, activity, city?, contacts?, sportIds: string[] }` (1–10 видов спорта) | `201` `OrganizationOwner` со статусом `pending` | 401; 403 `WRONG_ROLE`; 409 `ORG_ALREADY_EXISTS`; 422 |
| `GET /api/organizations/me` | `organization` | — | `200` `OrganizationOwner` | 401; 403 `WRONG_ROLE`; 404 `ORG_NOT_FOUND` (организации ещё нет: фронт показывает форму подачи) |
| `PATCH /api/organizations/me` | `organization`, владелец | любые поля из создания, частично | `200` `OrganizationOwner`. **Статус не меняется** | 404; 409 `ORG_NAME_TAKEN` (имя уже у допущенной организации); 422 |
| `POST /api/organizations/me/resubmit` | `organization`, только при `rejected` | — | `200` `OrganizationOwner`: статус `pending`, причина и решение очищены | 404; 409 `ORG_NOT_REJECTED` |
| `GET /api/organizations` | любой | `q?`, `sportId?`, `city?`, `limit?`, `offset?` | `200` `{ items: OrganizationPublic[], total }`, только `approved`, сортировка по названию | 422 |
| `GET /api/organizations/:id` | любой | — | `200` `OrganizationPublic`; владельцу и админу для не допущенной — `OrganizationOwner` | 404 `ORG_NOT_FOUND` (чужую не допущенную не раскрываем) |

События организации на её странице берутся из `GET /api/events?organizationId=:id` (участник 1). Публичный запрос отдаёт только `published`, владелец в кабинете видит свои события через `GET /api/events/mine`.

Решения по заявке (`approve`, `reject` с обязательной причиной) и поиск организаций в админке — модуль `admin`, участник 3. Они меняют `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`, а мой модуль эти поля только читает. Повторная подача — единственный случай, когда статус меняет владелец.

### Проверка «можно публиковать от имени организации» (задача 2.6)

Внутренняя функция, не эндпоинт. Её вызывает участник 1 в `POST /api/events`.

```ts
// apps/api/src/modules/organizations/publish-access.ts
resolvePublishingOrganization(db, user: { id: string; role: UserRole }): Promise<{ organizationId: string }>
```

| Ситуация | Результат |
| --- | --- |
| `role = 'organization'`, организация `approved` | `{ organizationId }`; создатель события ставит его в `events.organization_id` |
| `role = 'organization'`, организации нет | 404 `ORG_NOT_FOUND` |
| `role = 'organization'`, статус `pending` | 403 `ORG_NOT_APPROVED`: «Заявка на рассмотрении, публиковать события пока нельзя» |
| `role = 'organization'`, статус `rejected` | 403 `ORG_NOT_APPROVED`: сообщение с причиной отказа |
| `role = 'user'` | функцию не вызывают: `organization_id = null` |
| `role = 'admin'` | 403 `WRONG_ROLE` (админ не организует события) |

Организация создаёт события **только от своего имени**: выбора организатора в форме нет, `organizationId` из тела запроса не принимается.

---

## 2. Панель организатора

Общая для обычных пользователей-организаторов и организаций: права определяет только то, что пользователь **автор события** (`events.created_by`). Эндпоинты тонкие: правила переходов статусов живут в сервисе модуля `registrations` (участник 1), у панели своих запросов к таблице `registrations` нет.

```ts
type RegistrationStatus = 'confirmed' | 'pending' | 'rejected' | 'cancelled';

type OrganizerRegistration = {
  id: string;
  status: RegistrationStatus;
  message: string | null;     // сообщение при подаче заявки, до 500
  createdAt: string;
  decidedAt: string | null;
  user: { id: string; name: string; avatarUrl: string | null; about: string | null };
};
```

| Метод и путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| `GET /api/events/:eventId/organizer/registrations` | автор события | `status?` (`pending`, `confirmed`, `rejected`, `cancelled`), по умолчанию все | `200` `{ items: OrganizerRegistration[], counts: { pending, confirmed, rejected, cancelled }, capacity: number \| null }`; сначала `pending`, затем новее | 401; 403 `NOT_EVENT_AUTHOR`; 404 `EVENT_NOT_FOUND` |
| `POST /api/events/:eventId/organizer/registrations/:registrationId/decision` | автор события | `{ "decision": "confirm" \| "reject" }` | `200` `OrganizerRegistration` с новым статусом | 403 `NOT_EVENT_AUTHOR`; 404; 409 `NOT_PENDING` (решается только `pending`); 409 `EVENT_FULL` (подтверждение при исчерпанном лимите); 409 `EVENT_UNAVAILABLE` (событие не `published`); 422 |

Для работы панели от участника 1 нужны две функции сервиса `registrations` (пока их нет — на моках; запрос в [REQUESTS.md](../REQUESTS.md)):

```ts
listRegistrationsForAuthor(db, { eventId, actorId, status? }): Promise<{ items, counts, capacity }>
decideRegistration(db, { eventId, registrationId, actorId, decision: 'confirm' | 'reject' }): Promise<Registration>
// Проверяет: actor = автор события; запись в pending; событие published;
// при confirm учитывает capacity в той же транзакции с блокировкой строки события;
// пишет decided_by = actorId и decided_at.
```

Участник видит результат своего решения через собственные эндпоинты записей (участник 1: `GET /api/my/registrations`, карточка события): статусы и подписи — по DATA_MODEL («Вы записаны», «Заявка ждёт решения», «Заявка отклонена»).

---

## 3. Площадки и карта (киллер-фича «Место встречи»)

### Формы данных

```ts
type VenueType = 'cafe' | 'club' | 'field' | 'hall' | 'pool' | 'park' | 'yard' | 'other';

type Venue = {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  description: string | null;
  workingHours: string | null;
  contact: { name: string | null; phone: string | null; note: string | null } | null; // null, если контактов нет (парки, дворы)
  suitable?: boolean; // только если в запросе указан sportId: подходит ли тип площадки этому виду спорта
};
```

Подписи типов площадок и иконки — в [DATA_MODEL.md](../DATA_MODEL.md). Контакты вымышленные и публичные.

### Эндпоинты (чтение, без входа)

| Метод и путь | Запрос | Успех |
| --- | --- | --- |
| `GET /api/venues` | `type?` (через запятую), `sportId?`, `onlySuitable?` (`true`/`false`, по умолчанию `false`), `bbox?` (`minLng,minLat,maxLng,maxLat`), `q?` (название и адрес), `limit?` (по умолчанию 200, максимум 500) | `200` `{ items: Venue[] }`. Без пагинации: карта запрашивает видимую область. При `sportId` у площадок есть `suitable`, подходящие идут первыми, дальше по названию |
| `GET /api/venues/:id` | — | `200` `Venue`; 404 `VENUE_NOT_FOUND` |
| `GET /api/venue-types` | — | `200` `{ types: { value: VenueType, label: string }[], bySport: Record<sportId, VenueType[]> }`. Один запрос для карты и формы; `Cache-Control: public, max-age=300`. У своего вида спорта в `bySport` ключа нет: подсвечивать нечего, показываются все площадки |

Ошибки: 422 `INVALID_BBOX` (неверные числа или `min` больше `max`), 422 для остальных параметров.

### Как это связано с событием

Поля события `venueId`, `lat`, `lng` создаёт и валидирует участник 1 в `POST /api/events`:
- если указан `venueId`, сервер подставляет `lat`, `lng` и, если адрес не введён вручную, адрес площадки;
- можно поставить свою точку (`lat` и `lng` вместе) без `venueId` (двор, парк);
- можно указать только текстовый адрес: карта необязательна.

Карте событий (`EventsMap`) нужен от участника 1 запрос событий по области: `GET /api/events` с параметрами `bbox`, `sportId`, `joinMode`, `date` и компактным видом ответа для меток (в [REQUESTS.md](../REQUESTS.md)).

Запасной режим: если `GET /api/venues` недоступен или карта не загрузилась, форма события работает с текстовым адресом, а страница события показывает адрес и карточку площадки без мини-карты.
