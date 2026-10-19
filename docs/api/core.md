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

## В интерфейсе

- `useMe()` из `apps/web/src/modules/auth/api.ts` — кто вошёл (`data` — пользователь или `null`).
- `<RequireAuth roles={['admin']}>…</RequireAuth>` — страница только для вошедших или нужных ролей; без входа ведёт на `/login?next=…`.
- Экраны: `/login` (с кнопками демо-аккаунтов) и `/register`.
