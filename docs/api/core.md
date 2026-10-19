# API: основа, вход и админка (участник 3)

Общие правила и формат ошибок — [../api.md](../api.md). Типы запросов и ответов — `packages/shared/src/schemas/auth.ts`.

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | все | — | `{ status: "ok", db: "ok" }` | 503 `{ status: "degraded", db: "error" }` — база недоступна |
| POST | `/api/auth/register` | все | `{ name, email, password, role: "user" \| "organization" }` | 201 `{ user }`, ставит cookie сессии | 422 по полям (пароль от 8 символов; `role: "admin"` отклоняется); 409 `EMAIL_TAKEN` с `fields.email`; 429 |
| POST | `/api/auth/login` | все | `{ email, password }` | `{ user }`, ставит cookie сессии | 401 `INVALID_CREDENTIALS` — одинаково для неверного пароля и неизвестного email; 422; 429 |
| POST | `/api/auth/logout` | все | — | 204, сессия удалена, cookie очищена | — |
| GET | `/api/auth/me` | все | — | `{ user }` или `{ user: null }` без входа | — |

`user` — `{ id, role, name, email }`. Email сравнивается без учёта регистра и пробелов по краям.

**Ограничение попыток:** вход — 10 в минуту на связку «IP + email» (эксперты из одной сети не мешают друг другу), регистрация — 20 в минуту на IP.

**Сессия:** cookie `sid` (`HttpOnly`, `SameSite=Lax`, `Secure` при HTTPS), срок — `SESSION_TTL_DAYS` (7 дней). В базе хранится только SHA-256 токена.

## Админка (задачи 3.4–3.6)

Все маршруты — только для роли `admin`: без входа 401, с другой ролью 403. Типы — `packages/shared/src/schemas/admin.ts`. Каждое решение записывается в журнал (`audit_log`) в той же транзакции и показывается в `history` карточки. Объект с неверным или несуществующим `id` — 404.

| Метод | Путь | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/organizations` | `?status=pending\|approved\|rejected&q=&limit=20&offset=0` | `{ items: AdminOrganizationItem[], total }`: заявки на рассмотрении первыми, дальше новые; `q` ищет по названию, имени и email представителя | 422 |
| GET | `/api/admin/organizations/:id` | — | `AdminOrganizationDetails`: описание, контакты, интересы, причина отказа, мероприятия, история | 404 `ORG_NOT_FOUND` |
| POST | `/api/admin/organizations/:id/approve` | — | карточка со статусом `approved` | 409 `ORG_NOT_PENDING` — уже рассмотрена; 409 `ORG_NAME_TAKEN` — допущена другая с тем же названием |
| POST | `/api/admin/organizations/:id/reject` | `{ reason }` | карточка со статусом `rejected` и причиной | 422 `fields.reason`; 409 `ORG_NOT_PENDING` |
| GET | `/api/admin/events` | `?status=published\|unpublished\|deleted&q=&limit&offset` | `{ items: AdminEventItem[], total }`: все статусы, новые сверху; `q` — название, автор, организация | 422 |
| GET | `/api/admin/events/:id` | — | `AdminEventDetails`: описание, адрес, все сообщения с текстом (и скрытые), история | 404 `EVENT_NOT_FOUND` |
| POST | `/api/admin/events/:id/unpublish` | `{ reason }` | карточка со статусом `unpublished` | 422; 409 `EVENT_NOT_PUBLISHED` |
| POST | `/api/admin/events/:id/delete` | `{ reason }` | карточка со статусом `deleted` (строка остаётся) | 422; 409 `EVENT_ALREADY_DELETED` |
| POST | `/api/admin/comments/:id/hide` | `{ reason }` | карточка мероприятия этого сообщения | 422; 404 `COMMENT_NOT_FOUND`; 409 `COMMENT_ALREADY_HIDDEN` |

`reason` — от 5 до 500 символов; её видит организатор (у события — и записавшиеся). Восстановление публикации и возврат заявки на доработку не входят в обязательный минимум ТЗ и не сделаны: отклонённая организация исправляет заявку и подаёт снова (модуль `organizations`).

Экраны: `/admin/organizations`, `/admin/organizations/:id`, `/admin/events`, `/admin/events/:id`; пункт «Админка» в шапке виден только администратору.

## В интерфейсе

- `useMe()` из `apps/web/src/modules/auth/api.ts` — кто вошёл (`data` — пользователь или `null`).
- `<RequireAuth roles={['admin']}>…</RequireAuth>` — страница только для вошедших или нужных ролей; без входа ведёт на `/login?next=…`.
- Экраны: `/login` (с кнопками демо-аккаунтов) и `/register`.
