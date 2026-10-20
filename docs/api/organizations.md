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
| Поиск адреса (`/api/geocode`) | нет | да | да | да |

---

## 1. Организации

Формы `OrganizationPublic`, `OrganizationOwner`, `OrganizationView`, `SportRef` и схемы запросов — в `packages/shared/src/schemas/organizations.ts`.

| Метод и путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| `POST /api/organizations` | `organization` без организации | `createOrganizationBody`: `name` (2–100, пробелы схлопываются), `description` (10–1000), `activity` (2–100), `city?` (≤80), `contacts?` (≤300), `sportIds` (из списка, может быть пустым), `sportNames?` (свои варианты, 2–40 символов); вместе 1–10 видов, дубли убираются | `201` `OrganizationOwner`, статус `pending` | 409 `ORG_ALREADY_EXISTS`; 409 `ORG_NAME_TAKEN` (имя уже у допущенной организации, иначе её нельзя будет одобрить); 422 (в т.ч. `fields.sportIds`, если вида спорта нет или ни одного не выбрано) |
| `GET /api/organizations/me` | `organization` | — | `200` `OrganizationOwner` | 404 `ORG_NOT_FOUND`: организации ещё нет, интерфейс показывает форму подачи |
| `PATCH /api/organizations/me` | `organization` | `updateOrganizationBody`: любые поля частично, пустая строка очищает `city`/`contacts`; виды спорта заменяются целиком, `sportNames` — только вместе с `sportIds` | `200` `OrganizationOwner`, статус не меняется | 404; 409 `ORG_NAME_TAKEN`; 422 (пустое тело — «Нет изменений»; `fields.sportNames` без `sportIds`) |
| `POST /api/organizations/me/resubmit` | `organization`, статус `rejected` | — | `200` `OrganizationOwner`: `pending`, причина и решение очищены | 404; 409 `ORG_NOT_REJECTED` |
| `GET /api/organizations` | любой | `q?` (название и описание), `sportId?`, `city?`, `limit` (1–100, 20), `offset` (0) | `200` `{ items: OrganizationPublic[], total }` — только `approved`, по названию | 422 |
| `GET /api/organizations/:id` | любой | — | `200` `OrganizationView`: `{ view: 'public', … }` или `{ view: 'owner', … }` для владельца и админа | 404 `ORG_NOT_FOUND` (чужую недопущенную не раскрываем) |

Свой вид спорта (`sportNames`) ищется и создаётся так же, как `sportName` у события ([events.md](events.md), «Виды спорта»): по нормализованному ключу находится существующий («футбол » → «Футбол»), новое название попадает в каталог с `isCustom = true` без правки кода. Из дублей по ключу остаётся первый.

Подписи статусов заявки — `ORG_STATUS_LABELS`. События на странице организации — `GET /api/events?organizationId=:id` (участник 1).

Решения по заявке (одобрить, отклонить с причиной) и поиск в админке — модуль `admin`, участник 3. Он меняет `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`; этот модуль их только читает, кроме повторной подачи владельцем. Повторная подача обновляет строку только если статус всё ещё `rejected`: гонка с решением админа даёт 409, а не перезапись.

### Для других модулей

```ts
// apps/api/src/modules/organizations/service.ts — вызывает POST /api/events (участник 1)
resolvePublishingOrganization(user: SessionUser, ex?: Db | Tx): Promise<{ organizationId: string; name: string }> // ex — транзакция создания события
```

| Ситуация | Результат |
| --- | --- |
| организация `approved` | `{ organizationId, name }`: сервер событий ставит `events.organization_id` |
| организации нет | 404 `ORG_NOT_FOUND`: «Сначала подайте заявку на допуск организации…» |
| `pending` | 403 `ORG_NOT_APPROVED`: «Заявка на рассмотрении…» |
| `rejected` | 403 `ORG_NOT_APPROVED` с причиной отказа в тексте |
| роль не `organization` | 403 `FORBIDDEN` |

Организация создаёт события только от своего имени: выбора организатора в форме нет, `organizationId` из тела запроса не принимается.

---

## 2. Панель организатора (задача 2.7)

Права определяет только авторство события (`events.created_by`), поэтому панель общая для пользователей-организаторов и организаций. Правила решений живут в сервисе `registrations` участника 1: `listRegistrationsForAuthor` и `decideRegistration` (сигнатуры и ошибки — [api/events.md](events.md), «Сервис для панели организатора»). Панель вызывает их и пробрасывает их ошибки (`EVENT_NOT_FOUND`, `REGISTRATION_NOT_FOUND`, `NOT_EVENT_AUTHOR`, `NOT_PENDING`, `EVENT_UNAVAILABLE`, `EVENT_FULL` и др.).

| Метод и путь | Кто | Запрос | Успех |
| --- | --- | --- | --- |
| `GET /api/events/:eventId/organizer/registrations` | автор события | `status?` (`pending`, `confirmed`, `rejected`, `cancelled`), по умолчанию все | `200` `{ items: OrganizerRegistration[], counts, capacity }`: сначала `pending`, затем новее |
| `POST /api/events/:eventId/organizer/registrations/:registrationId/decision` | автор события | `{ "decision": "confirm" \| "reject" }` | `200` `OrganizerRegistration` с новым статусом |

`OrganizerRegistration` — форма из сервиса участника 1. Маршруты подключаются, когда сервис `registrations` будет в `main`.

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
// неизвестная площадка — 422 VENUE_NOT_FOUND с fields.venueId (текст под полем формы)
```

Сервер событий берёт из ответа `lat`, `lng` и, если адрес не введён вручную, `address`. Своя точка (`lat` и `lng` вместе) без `venueId` и событие только с текстовым адресом тоже допустимы: карта необязательна.

```ts
// apps/api/src/modules/geocoding/geocoder.ts — вызывают createEvent и updateEvent (участник 1)
locateAddress(address: string): Promise<{ lat: number; lng: number } | null>
// событие без площадки и без точки: ищем точку по адресу, чтобы встреча попала на карту;
// не нашли или сервис недоступен — null, событие сохраняется как есть
```

Карте событий нужен `GET /api/events` с `bbox` (уже есть в [api/events.md](events.md)).

Запасной режим: если карта или `GET /api/venues` недоступны, форма события работает с текстовым адресом, а страница события показывает адрес и карточку площадки без мини-карты.

### Поиск адреса

Форма встречи (`AddressField` в `apps/web/src/modules/org/map`), действует то, что сделали последним: вписали адрес — после паузы в наборе или сразу по Enter метка встаёт по нему; поставили или перетащили метку на карте — адрес этой точки сам пишется в поле и в подпись над меткой; выбрали площадку — в поле её адрес. Дописали к адресу метки подробности («…, подъезд 2») — метка остаётся на месте.

| Метод и путь | Запрос | Успех | Ошибки |
| --- | --- | --- | --- |
| `GET /api/geocode` | `q` (3–300 символов) | `200` `{ items: GeocodePlace[] }` — до пяти мест в Красноярске, лучшее первым; `[]` — не нашли | 401; 422 с `fields.q`; 429 `RATE_LIMITED` (30 в минуту); 503 `GEOCODER_UNAVAILABLE` |
| `GET /api/geocode/reverse` | `lat`, `lng` | `200` `{ place: GeocodePlace \| null }` — адрес точки: ближайший дом (`layer=address`) — «улица Авиаторов, 21», дом без улицы — «остров Татышев, 3Г», только улица — её название; `lat`/`lng` — та же точка. `null` — рядом ни дома, ни улицы (середина парка, река) | 401; 422; 429; 503 `GEOCODER_UNAVAILABLE` |

`GeocodePlace` — `{ label, context, lat, lng }`: `label` — «улица Весны, 23» или название места («Покровский парк»), `context` — район или микрорайон.

Правила Nominatim соблюдаем на сервере: не чаще запроса в секунду на весь сервер (очередь, больше 10 ждущих — сразу 503), свой `User-Agent`, ответы в памяти на сутки, без подсказок на каждую букву — форма ищет после паузы в наборе (0,9 с) или по Enter, повторы того же адреса берёт из кэша. Поиск только в границах Красноярска (`viewbox`, `bounded=1`).

Адрес, как его пишут люди, сервер сначала чистит: раскрывает сокращения (`ул.`, `пр.`, `пл.`, `д.`), убирает ориентиры («двор», «главный вход», «сбор у входа в…», «2 этаж»). Не нашли — пробует без последней части после запятой (до трёх запросов). Переменная `GEOCODER_URL` (по умолчанию `https://nominatim.openstreetmap.org`); пустая — поиск выключен. В тестах поиск выключен всегда.
