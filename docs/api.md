# Контракт API

Здесь описываем всё, через что общаются фронт и бэк. Меняешь контракт — меняешь его описание в том же PR.

Контракт по зонам (каждый участник ведёт свой файл, чтобы PR не конфликтовали):
- [Основа, вход и админка](api/core.md): участник 3
- [Организации, панель организатора, площадки](api/organizations.md): участник 2
- Пользователь: мероприятия, запись, комментарии — `api/events.md`, участник 1

В чужом файле ничего не правим: нужное изменение — запись в [REQUESTS.md](REQUESTS.md).

## Общие правила

- Все пути начинаются с `/api`. Тела запросов и ответов — JSON.
- **Вход:** сессия в cookie `sid` (`HttpOnly`), браузер отправляет её сам. Права проверяются на сервере по роли из сессии.
- **Ошибка всегда одного вида:**
  ```json
  { "error": { "code": "ORG_NOT_APPROVED", "message": "Организация ещё не допущена администратором" } }
  { "error": { "code": "VALIDATION_ERROR", "message": "Проверьте заполнение полей", "fields": { "title": "Слишком короткое название" } } }
  ```
  `message` — готовый русский текст для показа человеку. `fields` — только для 422: текст под каждым полем формы.
- **Общие коды** (`COMMON_ERROR_CODES` в `packages/shared/src/errors.ts`). Модуль может завести свой код для своего случая (`ORG_NOT_APPROVED`, `INVALID_BBOX`) с подходящим статусом.

  | `code` | HTTP | Когда |
  | --- | --- | --- |
  | `BAD_REQUEST` | 400 | запрос не разобрать (битый JSON) |
  | `UNAUTHORIZED` | 401 | не выполнен вход |
  | `FORBIDDEN` | 403 | нет прав на действие |
  | `NOT_FOUND` | 404 | нет такого объекта или он недоступен этому пользователю |
  | `CONFLICT` | 409 | действие противоречит состоянию |
  | `VALIDATION_ERROR` | 422 | неверные поля; `fields` — по полям |
  | `RATE_LIMITED` | 429 | слишком много попыток |
  | `INTERNAL` | 500 | ошибка сервера |

## Как это выглядит в коде

Сервер (`apps/api/src/lib/errors.ts`, `apps/api/src/modules/auth/guards.ts`):

```ts
import { z } from 'zod';
import { AppError, errors, parse } from '../../lib/errors';
import { currentUser, requireRole } from '../auth/guards';

app.post('/organizations', { preHandler: requireRole('organization') }, async (request) => {
  const user = currentUser(request); // вошедший пользователь с нужной ролью
  const body = parse(createOrganizationBody, request.body); // при ошибке — 422 с fields
  if (exists) throw new AppError(409, 'ORG_ALREADY_EXISTS', 'У вашего аккаунта уже есть организация');
  if (!found) throw errors.notFound('Организация не найдена');
});
```

- `requireAuth` — только вошедшие (иначе 401); `requireRole('user', 'organization')` — только эти роли (401 без входа, 403 с другой ролью).
- `request.user` — вошедший пользователь или `null`, если маршрут открыт всем, но показывает разное.

Интерфейс (`apps/web/src/shared/api/client.ts`): `api()` бросает `ApiError` с полями `status`, `code`, `message` и `fields`.
