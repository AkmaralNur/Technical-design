# 🚆 TrainTix — бронирование билетов на поезд

Полноценное веб-приложение по [техническому дизайну](Technical_Design.md):
**React** (frontend) · **Node.js + Express** (backend) · **PostgreSQL** (база данных) · TypeScript везде.

- Поиск поездов, в том числе между промежуточными станциями, с фильтрами и сортировкой
- Схема вагона и выбор места; место занято только на **своём участке** маршрута
- Защита от двойной продажи на уровне БД (`EXCLUDE` в PostgreSQL)
- Классы Эконом / Бизнес со своими ценами
- Мои билеты (Предстоящие / Завершённые / Отменённые), отмена, **PDF-билет с QR-кодом**
- Письма о брони, отмене, отмене рейса и изменении расписания (очередь `email_outbox`)
- Админка: станции, поезда, вагоны и места, маршруты, цены, рейсы на даты, изменение времени, отмена рейса, все бронирования + CSV

---

## Быстрый старт (Windows, PostgreSQL уже установлен)

Нужно: **Node.js 20+** и **PostgreSQL** (запущенная служба).

```bash
# 1. Установить зависимости (корень + server + client)
npm run install:all

# 2. Указать пароль от PostgreSQL в server/.env (строка DATABASE_URL)
#    DATABASE_URL=postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/traintix
#    (если файла нет — скопируйте server/.env.example в server/.env)

# 3. Создать базу traintix, таблицы и тестовые данные
npm run setup

# 4. Запустить сервер и сайт одной командой
npm run dev
```

Откройте **http://localhost:5173**

| Кто | Email | Пароль |
| --- | --- | --- |
| Администратор | `admin@traintix.local` | `Admin12345` (из `SEED_ADMIN_PASSWORD`) |
| Пассажир | `anna@example.com` | `secret123` |
| Пассажир | `petr@example.com` | `secret123` |

> Тестовые данные: станции Prague, Brno, Vienna, Bratislava, Ostrava, Pardubice; поезда T101, T205, T310;
> рейсы на 14 дней вперёд от сегодняшнего дня. Попробуйте поиск **Prague → Brno на завтра**.

---

## Команды

| Команда (из корня) | Что делает |
| --- | --- |
| `npm run dev` | Сервер (:3000) + сайт (:5173) с автоперезагрузкой |
| `npm run setup` | Создать БД → применить миграции → заполнить тестовыми данными |
| `npm run seed` | Заново заполнить БД тестовыми данными (**очищает таблицы!**) |
| `npm test` | Unit- и API-тесты (на отдельной базе `traintix_test`) |
| `npm run build` | Собрать сайт и сервер для продакшена |
| `npm start` | Запустить собранный проект: сайт + API на http://localhost:3000 |

Команды внутри `server/`:

| Команда | Что делает |
| --- | --- |
| `npm run db:migrate` | Применить миграции (`prisma migrate deploy`) |
| `npm run db:reset` | Удалить и создать базу заново + seed (только локально) |
| `npm run studio` | Prisma Studio — просмотр данных в браузере (http://localhost:5555) |

---

## Структура проекта

```
TrainTix/
├── client/                  # FRONTEND — React 18 + Vite + Tailwind
│   └── src/
│       ├── api/             # запросы к серверу (axios), типы
│       ├── components/      # SearchForm, TripCard, CarriageMap, StopsTimeline, ui…
│       ├── context/         # AuthContext (кто вошёл), ToastContext
│       ├── pages/           # страницы пассажира
│       │   └── admin/       # страницы администратора
│       └── utils/           # форматирование дат, цен; выбор места (sessionStorage)
├── server/                  # BACKEND — Node.js + Express + Prisma
│   ├── prisma/
│   │   ├── schema.prisma    # схема БД
│   │   ├── migrations/      # SQL-миграции (в т.ч. EXCLUDE no_double_booking)
│   │   └── seed.ts          # тестовые данные
│   ├── src/
│   │   ├── modules/         # auth, stations, trains, routes, trips, tickets, admin, audit, notifications
│   │   │                    # (в каждом: routes → controller → service → repository/schema)
│   │   ├── middleware/      # authenticate, requireRole, validate, errorHandler, checkOrigin
│   │   ├── utils/           # AppError, ticketNumber, segments, format, logger
│   │   ├── app.ts           # сборка Express
│   │   └── server.ts        # запуск сервера + отправщика писем
│   ├── scripts/             # createDb, resetDb
│   └── tests/               # vitest + supertest
├── docker-compose.yml       # PostgreSQL + Mailpit в Docker (необязательно)
├── Dockerfile               # продакшен-образ
└── Technical_Design.md      # технический дизайн
```

## База данных

13 таблиц по разделу 8: `users`, `stations`, `trains`, `carriages`, `seats`, `routes`, `route_stops`, `fares`,
`trips`, `trip_stops`, `tickets`, `audit_log`, `email_outbox`.

Главное правило — в самой базе:

```sql
CONSTRAINT no_double_booking EXCLUDE USING gist (
  trip_id WITH =, seat_id WITH =, int4range(from_stop_order, to_stop_order) WITH &&
) WHERE (status = 'CONFIRMED')
```

Посмотреть данные можно в VS Code (расширение PostgreSQL → база `traintix`), в pgAdmin или через `npm run studio` в папке `server`.

## Письма

Если `SMTP_HOST` в `server/.env` пустой, письма **не отправляются**, а сохраняются как HTML-файлы в `server/dev-mails/`
(их можно открыть в браузере). Для настоящей отправки укажите SMTP-сервер (например, Mailpit `localhost:1025` или Brevo).

## API

Все адреса — под `/api`, формат ошибок `{ "error": { "code", "message", "details" } }`. Полный список — раздел 9 технического дизайна.
Основные: `POST /api/auth/register|login|logout`, `GET /api/auth/me`, `GET /api/stations`, `GET /api/trips/search`,
`GET /api/trips/:id`, `GET /api/trips/:id/seats`, `POST /api/tickets`, `GET /api/tickets`, `POST /api/tickets/:id/cancel`,
`GET /api/tickets/:id/pdf`, `/api/admin/*`.
