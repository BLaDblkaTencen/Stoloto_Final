# API: основа, вход и админка (участник 3)

Общие правила и формат ошибок — [../api.md](../api.md).

| Метод | Путь | Кто | Запрос | Успех | Ошибки |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/health` | все | — | `{ status: "ok", db: "ok" }` | 503 `{ status: "degraded", db: "error" }` — база недоступна |

## В работе (задача 3.2)

Вход и регистрация: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/auth/me`. Описание появится здесь вместе с кодом.
