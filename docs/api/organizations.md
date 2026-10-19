# Контракт API: организации, панель организатора, площадки

Зона участника 2. Модели и статусы — [DATA_MODEL.md](../DATA_MODEL.md), таблицы — [DB_SCHEMA.md](../DB_SCHEMA.md). Формат ошибок, коды и `requireRole` — [api.md](../api.md).

| Что | Где |
| --- | --- |
| Схемы Zod, типы ответов, подписи статусов и типов площадок | `packages/shared/src/schemas/organizations.ts`, `venues.ts` (импорт `@sport/shared/schemas/…`) |
| Сервер | `apps/api/src/modules/organizations`, `venues`, `organizer-panel`: `rules.ts`/`search.ts` — правила без базы и с тестами, `service.ts` — база, `routes.ts` — HTTP |

Если маршрут закрыт `requireRole(...)`, без входа — `401 UNAUTHORIZED`, с чужой ролью — `403 FORBIDDEN`. Ошибки входных данных — `422 VALIDATION_ERROR` с `fields`. Идентификаторы — UUID строкой, время — ISO 8601 (UTC). Неверный UUID в пути отвечает как «не найдено», а не ошибкой базы.

## Права доступа

| Действие | Аноним | user | organization | admin |
| --- | --- | --- | --- | --- |
| Список и страница допущенных организаций | да | да | да | да |
| Страница недопущенной организации | 404 | 404 | только своя | да (чтение) |
| Создать организацию, править, подать повторно | нет | нет | да, одну свою | нет |
| Решение по заявке организации | нет | нет | нет | да (модуль admin, участник 3) |
| Панель организатора | нет | автор события | автор события | нет |
| Площадки и типы площадок | да | да | да | да |

---

## 1. Организации

Формы `OrganizationPublic`, `OrganizationOwner`, `OrganizationView`, `SportRef` и схемы запросов — в `packages/shared/src/schemas/organizations.ts`.

| Метод и путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| `POST /api/organizations` | `organization` без организации | `createOrganizationBody`: `name` (2–100, пробелы схлопываются), `description` (10–1000), `activity` (2–100), `city?` (≤80), `contacts?` (≤300), `sportIds` (1–10, дубли убираются) | `201` `OrganizationOwner`, статус `pending` | 409 `ORG_ALREADY_EXISTS`; 409 `ORG_NAME_TAKEN` (имя уже у допущенной организации, иначе её нельзя будет одобрить); 422 (в т.ч. `fields.sportIds`, если вида спорта нет) |
| `GET /api/organizations/me` | `organization` | — | `200` `OrganizationOwner` | 404 `ORG_NOT_FOUND`: организации ещё нет, интерфейс показывает форму подачи |
| `PATCH /api/organizations/me` | `organization` | `updateOrganizationBody`: любые поля частично, пустая строка очищает `city`/`contacts` | `200` `OrganizationOwner`, статус не меняется | 404; 409 `ORG_NAME_TAKEN`; 422 (пустое тело — «Нет изменений») |
| `POST /api/organizations/me/resubmit` | `organization`, статус `rejected` | — | `200` `OrganizationOwner`: `pending`, причина и решение очищены | 404; 409 `ORG_NOT_REJECTED` |
| `GET /api/organizations` | любой | `q?` (название и описание), `sportId?`, `city?`, `limit` (1–100, 20), `offset` (0) | `200` `{ items: OrganizationPublic[], total }` — только `approved`, по названию | 422 |
| `GET /api/organizations/:id` | любой | — | `200` `OrganizationView`: `{ view: 'public', … }` или `{ view: 'owner', … }` для владельца и админа | 404 `ORG_NOT_FOUND` (чужую недопущенную не раскрываем) |

Подписи статусов заявки — `ORG_STATUS_LABELS`. События на странице организации — `GET /api/events?organizationId=:id` (участник 1).

Решения по заявке (одобрить, отклонить с причиной) и поиск в админке — модуль `admin`, участник 3. Он меняет `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`; этот модуль их только читает, кроме повторной подачи владельцем. Повторная подача обновляет строку только если статус всё ещё `rejected`: гонка с решением админа даёт 409, а не перезапись.

### Для других модулей

```ts
// apps/api/src/modules/organizations/service.ts — вызывает POST /api/events (участник 1)
assertCanPublishAsOrganization(user: SessionUser): Promise<{ organizationId: string; name: string }>
```

| Ситуация | Результат |
| --- | --- |
| организация `approved` | `{ organizationId, name }`: сервер событий ставит `events.organization_id` |
| организации нет | 403 `ORG_NOT_APPROVED`: «Сначала подайте заявку на допуск организации…» |
| `pending` | 403 `ORG_NOT_APPROVED`: «Заявка на рассмотрении…» |
| `rejected` | 403 `ORG_NOT_APPROVED` с причиной отказа в тексте |
| роль не `organization` | 403 `FORBIDDEN` |

Организация создаёт события только от своего имени: выбора организатора в форме нет, `organizationId` из тела запроса не принимается.

---

## 2. Панель организатора (задача 2.7)

Права определяет только авторство события (`events.created_by`), поэтому панель общая для пользователей-организаторов и организаций. Правила решений живут в сервисе `registrations` участника 1 (`listForOrganizer`, `decide`, см. [api/events.md](events.md)); панель вызывает его и пробрасывает его ошибки (`NOT_EVENT_AUTHOR`, `NOT_PENDING`, `EVENT_UNAVAILABLE`, `EVENT_PAST`, `EVENT_FULL`).

| Метод и путь | Кто | Запрос | Успех |
| --- | --- | --- | --- |
| `GET /api/organizer/events/:eventId/registrations` | автор события | — | `200` `{ items: OrganizerRegistration[], counts: { pending, confirmed, rejected, cancelled } }`: сначала `pending`, затем новее. Вкладки по статусам фильтрует интерфейс |
| `POST /api/organizer/registrations/:registrationId/decision` | автор события | `{ "decision": "confirm" \| "reject" }` | `200` `OrganizerRegistration` с новым статусом |

`OrganizerRegistration` — форма из сервиса участника 1. Лимит мест и число участников интерфейс берёт из карточки события. Маршруты появятся, когда сервис `registrations` будет в `main`.

---

## 3. Площадки и карта (киллер-фича «Место встречи»)

Формы `Venue`, `VenueCard`, `VenueTypesResponse`, схема `venuesQuery`, `parseBbox`/`formatBbox`/`inBbox` и `VENUE_TYPE_LABELS` — в `packages/shared/src/schemas/venues.ts`: интерфейс собирает `bbox` той же функцией, что сервер разбирает.

| Метод и путь | Запрос | Успех | Ошибки |
| --- | --- | --- | --- |
| `GET /api/venues` | `type?` (через запятую), `sportId?`, `onlySuitable` (`true`/`false`, по умолчанию `false`), `bbox?` (`minLng,minLat,maxLng,maxLat`), `q?` (название и адрес), `limit` (1–500, по умолчанию 200) | `200` `{ items: Venue[] }`. При `sportId` у каждой площадки есть `suitable`, подходящие первыми, дальше по названию. У вида спорта без подсказки (свой вариант) подходят все | 422 с `fields.type` / `bbox` / `sportId` / `limit` |
| `GET /api/venues/:id` | — | `200` `VenueCard` | 404 `VENUE_NOT_FOUND` |
| `GET /api/venue-types` | — | `200` `VenueTypesResponse`: все типы с подписями и `bySport` | — |

Справочник меняется только сидом, поэтому сервер держит его в памяти (обновление раз в минуту) и отдаёт `Cache-Control: public, max-age=60` (типы — `300`). Сдвиги карты не нагружают базу.

### Для других модулей

```ts
// apps/api/src/modules/venues/service.ts — вызывает POST /api/events (участник 1)
resolveVenueForEvent(venueId: string): Promise<VenueCard>
// неизвестная площадка — 422 VALIDATION_ERROR, fields.venueId
```

Сервер событий берёт из ответа `lat`, `lng` и, если адрес не введён вручную, `address`. Своя точка (`lat` и `lng` вместе) без `venueId` и событие только с текстовым адресом тоже допустимы: карта необязательна.

Карте событий нужен `GET /api/events` с `bbox` (уже есть в [api/events.md](events.md)).

Запасной режим: если карта или `GET /api/venues` недоступны, форма события работает с текстовым адресом, а страница события показывает адрес и карточку площадки без мини-карты.
