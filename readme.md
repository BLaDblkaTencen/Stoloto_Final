# Платформа совместных спортивных активностей

Прототип для финала ЧР по продуктовому программированию (кейс Столото).
Исходное ТЗ: см. [docs/TZ.md](docs/TZ.md).

> TODO (участник 3, задача 3.9): описание продукта, правила доступа и модерации, имитации,
> ограничения, ссылка на деплой.

## Стек

TypeScript, React + Vite + Tailwind, Fastify, PostgreSQL + Drizzle, Leaflet. Подробно и почему так — [docs/STACK.md](docs/STACK.md).

## Запуск

Нужны Node.js 24 LTS, pnpm 10 и PostgreSQL (установленный или в Docker).

```bash
# 1. Зависимости и настройки
npm install -g pnpm@10.34.6   # если pnpm ещё нет
pnpm install
cp .env.example .env

# 2. База данных — один из вариантов:
docker compose up -d          # а) Postgres в Docker
# б) установленный PostgreSQL: создать пользователя и базу sport (пароль sport), один раз:
#    psql -U postgres -h 127.0.0.1 -c "CREATE ROLE sport LOGIN PASSWORD 'sport'" -c "CREATE DATABASE sport OWNER sport"

# 3. Схема и демо-данные
pnpm db:push
pnpm db:seed

# 4. Разработка: интерфейс http://127.0.0.1:5173, API http://127.0.0.1:3000/api/health
pnpm dev
```

Прод: `pnpm build && NODE_ENV=production pnpm start` — сервер на порту `PORT` отдаёт и API, и собранный интерфейс.

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | интерфейс и API с перезапуском при правках |
| `pnpm typecheck` | проверка типов во всех пакетах |
| `pnpm build` | сборка интерфейса в `apps/web/dist` |
| `pnpm db:push` | синхронизировать базу со схемой (без файлов миграций) |
| `pnpm db:seed` | стереть данные и загрузить демо-данные заново |
| `pnpm format` | форматирование Prettier |

## Структура

```
apps/api            сервер Fastify
  src/db/schema     схема базы по файлу на модуль (docs/DB_SCHEMA.md)
  src/db/seed       демо-данные
  src/modules/*     модули API: auth, admin, sports, events, registrations, comments,
                    profiles, organizations, organizer-panel, venues (владельцы — docs/OWNERSHIP.md)
  src/lib           общие помощники: ошибки и проверка входных данных
apps/web            интерфейс React
  src/app           маршрутизатор и раскладка страниц
  src/modules/*     экраны зон: user, org, admin, auth
  src/shared        клиент API и общие компоненты (shared/ui)
packages/shared     общее для сервера и интерфейса: статусы, формат ошибок, демо-аккаунты, Zod-схемы
docs                задачи, модель данных, контракт API, дизайн
```

## Демо-аккаунты

Пароль у всех: `demo-sport-2026`. Первые три входят кнопками «Войти как…» на экране входа.

| Роль | Email |
| --- | --- |
| Участник | `user1@demo.local` |
| Организация (допущена) | `org.approved@demo.local` |
| Администратор | `admin@demo.local` |
| Участники | `user2@demo.local`, `user3@demo.local` |
| Организация (заявка на рассмотрении) | `org.pending@demo.local` |
| Организация (заявка отклонена) | `org.rejected@demo.local` |

Какими аккаунтами и на каких событиях пройти шесть сценариев ТЗ — [docs/DEMO_DATA.md](docs/DEMO_DATA.md).
