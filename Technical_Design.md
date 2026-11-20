# TrainTix — Технический дизайн

| | |
| --- | --- |
| **Проект** | TrainTix — сайт бронирования билетов на поезд |
| **Версия документа** | 2.0 |
| **Дата** | 20.11.2026 |
| **Основа** | PRD «TrainTix — Train Ticket Booking Platform», версия 1.0 |
| **Стек** | React (frontend) · Node.js + Express (backend) · PostgreSQL (база данных) |
| **Архитектура** | Монолит (одно приложение + одна база данных) |

---

## Содержание

1. [Введение](#1-введение)
2. [Обзор системы](#2-обзор-системы)
3. [Требования](#3-требования)
4. [Роли и права доступа](#4-роли-и-права-доступа)
5. [Архитектура системы](#5-архитектура-системы)
6. [Технологический стек](#6-технологический-стек)
7. [Архитектура Backend](#7-архитектура-backend)
8. [Проектирование базы данных](#8-проектирование-базы-данных)
9. [Проектирование API](#9-проектирование-api)
10. [Бизнес-логика](#10-бизнес-логика)
11. [Алгоритм доступности мест](#11-алгоритм-доступности-мест)
12. [Аутентификация и безопасность](#12-аутентификация-и-безопасность)
13. [Обработка ошибок](#13-обработка-ошибок)
14. [Конкурентное бронирование](#14-конкурентное-бронирование)
15. [Логирование](#15-логирование)
16. [Интеграции](#16-интеграции)
17. [Frontend](#17-frontend)
18. [Развёртывание](#18-развёртывание)
19. [Тестирование](#19-тестирование)
20. [Нефункциональные требования](#20-нефункциональные-требования)
21. [Ограничения и риски](#21-ограничения-и-риски)
22. [Приложения](#22-приложения)

---

## 1. Введение

### 1.1 Назначение документа

Этот документ объясняет, **как технически устроен TrainTix** и **как его реализовать**.
Прочитав его, разработчик должен понимать:

- из каких частей состоит приложение и как они связаны;
- какие таблицы нужны в базе данных и что в них хранится;
- какие запросы (API) принимает сервер и что он отвечает;
- по каким алгоритмам работают поиск, проверка мест, бронирование и отмена;
- как защитить систему от ошибок и от продажи одного места двум людям;
- как запустить, протестировать и развернуть проект.

### 1.2 Цели проекта

1. Пассажир может найти поезд между **любыми двумя станциями** маршрута, даже промежуточными.
2. Пассажир видит, **какие места свободны именно на его участке** пути.
3. Пассажир бронирует **одно место для одного человека** и сразу получает билет.
4. **Одно место никогда не продаётся дважды** на пересекающиеся участки одного рейса.
5. Пассажир может посмотреть свои билеты и отменить билет до отправления.
6. Администратор может настроить станции, поезда, места, маршруты, расписание и цены.

### 1.3 Для кого документ

| Читатель | Что ему важно |
| --- | --- |
| Разработчик backend | Разделы 7–15 |
| Разработчик frontend | Разделы 9, 13, 17 |
| Тестировщик | Разделы 3, 13, 19 |
| Преподаватель / проверяющий | Разделы 2–5, 10–11, 14, 21 |

### 1.4 Что входит и что не входит в версию 1.0

| Входит | Не входит |
| --- | --- |
| Регистрация, вход, выход | Пересадки и составные маршруты |
| Поиск прямых поездов | Билеты «туда-обратно» |
| Выбор одного места на участок | Несколько пассажиров в одной брони |
| Бронирование без оплаты | Реальные платежи, возвраты денег, скидки |
| Мои билеты и отмена | Внешние железнодорожные сервисы |
| Админ-панель | Мобильное приложение |

---

## 2. Обзор системы

### 2.1 Что такое TrainTix

TrainTix — это сайт, на котором пассажир ищет поезд, выбирает место и бронирует билет.
Поезд едет по маршруту из нескольких станций. Пассажир может сесть и выйти на любой станции
маршрута, если станция посадки идёт **раньше** станции выхода.

### 2.2 Главный пример (используется во всём документе)

Поезд **T101** едет по маршруту **Prague → Brno → Vienna**.

```
 Остановка №:     0                1                2
               Prague ───────── Brno ───────── Vienna
                      участок 0        участок 1
```

- Пассажир A покупает место **12A** на участок **Prague → Brno** (участок 0).
- Пассажир B **может** купить то же место **12A** на **Brno → Vienna** (участок 1) — участки не пересекаются.
- Пассажир C **не может** купить **12A** на **Prague → Vienna** (участки 0 и 1) — место уже занято на обоих участках.

### 2.3 Основные возможности

| Для кого | Возможность |
| --- | --- |
| Гость | Регистрация, вход, поиск поездов, просмотр рейса и свободных мест |
| Пассажир | Всё, что гость + бронирование, просмотр своих билетов, отмена билета, просмотр аккаунта |
| Администратор | Станции, поезда, места, маршруты, расписание, цены, рейсы на даты, просмотр всех бронирований |

### 2.4 Система в одной картинке

```
┌──────────────┐     HTTPS      ┌───────────────────────────┐      SQL      ┌──────────────┐
│   Браузер    │ ─────────────► │   Сервер Node.js (Express) │ ────────────► │  PostgreSQL  │
│  React-сайт  │ ◄───────────── │  сайт + API /api/...       │ ◄──────────── │  база данных │
└──────────────┘     JSON       └───────────────────────────┘               └──────────────┘
```

---

## 3. Требования

### 3.1 Функциональные требования

Каждое требование имеет номер — по нему удобно ссылаться в тестах.

**Аккаунт**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-01 | Гость регистрируется по имени, email и паролю | `POST /api/auth/register` |
| FR-02 | Пользователь входит и выходит из системы | `POST /api/auth/login`, `/logout` |
| FR-03 | Пассажир видит данные своего аккаунта | `GET /api/auth/me`, страница «Аккаунт» |
| FR-04 | Подтвердить бронь и смотреть билеты может только вошедший пассажир | middleware `authenticate` |

**Поиск**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-05 | Поиск по станции отправления, станции прибытия и дате | `GET /api/trips/search` |
| FR-06 | Находятся поезда, где обе станции есть в маршруте в правильном порядке, даже если они промежуточные | Алгоритм 10.2 |
| FR-07 | В результатах: номер поезда, время отправления и прибытия, длительность, цена, есть ли места | Ответ поиска |
| FR-08 | Если поездов нет — понятное сообщение | Frontend, пустой список |
| FR-09 | Нельзя искать, если станция отправления = станции прибытия | Валидация, ошибка `SAME_STATIONS` |

**Рейс и место**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-10 | Показать все остановки рейса по порядку | `GET /api/trips/:id` |
| FR-11 | Показать свободные места именно для выбранного участка | `GET /api/trips/:id/seats`, алгоритм 11 |
| FR-12 | Выбрать одно свободное место для одного пассажира | Страница рейса |
| FR-13 | Показанная цена — окончательная | Таблица `fares` |

**Бронирование**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-14 | Перед подтверждением пассажир видит рейс, место и цену | Страница «Проверка брони» |
| FR-15 | После брони создаётся билет с уникальным номером | `POST /api/tickets` |
| FR-16 | Билет содержит: пассажира, поезд, дату, станции и время, место, цену | Таблица `tickets` |
| FR-17 | Если место заняли раньше — бронь не создаётся, показывается понятное сообщение | Ошибка `SEAT_UNAVAILABLE` |
| FR-18 | Никогда не два подтверждённых билета на одно место на пересекающихся участках | Раздел 14 |

**Мои билеты и отмена**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-19 | Пассажир видит предстоящие, завершённые и отменённые билеты | `GET /api/tickets` |
| FR-20 | Пассажир открывает подробности билета | `GET /api/tickets/:id` |
| FR-21 | Отмена подтверждённого билета до отправления со своей станции | `POST /api/tickets/:id/cancel` |
| FR-22 | Отменённый билет остаётся в списке со статусом «Отменён» | Статус `CANCELLED` |
| FR-23 | После отмены место снова свободно на этом участке | Алгоритм 10.5 |
| FR-24 | Нельзя смотреть и отменять чужие билеты | Проверка `user_id` |

**Администратор**

| ID | Требование | Где реализовано |
| --- | --- | --- |
| FR-25 | Добавлять и изменять станции | `/api/admin/stations` |
| FR-26 | Создавать и изменять поезда и их места | `/api/admin/trains`, `/seats` |
| FR-27 | Задавать маршрут как упорядоченный список станций | `/api/admin/routes` |
| FR-28 | Задавать время прибытия/отправления и создавать рейсы на даты | `/api/admin/routes`, `/api/admin/trips` |
| FR-29 | Задавать цены между остановками | `/api/admin/routes/:id/fares` |
| FR-30 | Смотреть все бронирования и их статусы | `/api/admin/tickets` |
| FR-31 | Изменения не должны «молча» ломать подтверждённые билеты | Алгоритм 10.7 |

### 3.2 Нефункциональные требования (кратко)

Подробно — в [разделе 20](#20-нефункциональные-требования).

| ID | Требование |
| --- | --- |
| NFR-01 | Поиск отвечает быстрее 1 секунды |
| NFR-02 | Пароли хранятся только в виде хэша |
| NFR-03 | Сайт удобно работает на телефоне и компьютере |
| NFR-04 | Все ошибки показываются пользователю понятным текстом |
| NFR-05 | Данные не теряются при перезапуске сервера |

---

## 4. Роли и права доступа

### 4.1 Роли

| Роль | Кто это | Как получить |
| --- | --- | --- |
| **Гость** | Любой посетитель без входа | По умолчанию |
| **Пассажир** (`PASSENGER`) | Зарегистрированный пользователь | Регистрация на сайте |
| **Администратор** (`ADMIN`) | Сотрудник, который настраивает поезда | Создаётся скриптом `seed` или вручную в БД. Через сайт стать админом **нельзя** |

### 4.2 Матрица прав

✅ — можно, ❌ — нельзя, 🔸 — только свои данные

| Действие | Гость | Пассажир | Админ |
| --- | :---: | :---: | :---: |
| Регистрация / вход | ✅ | — | — |
| Поиск поездов | ✅ | ✅ | ✅ |
| Просмотр рейса и свободных мест | ✅ | ✅ | ✅ |
| Подтвердить бронирование | ❌ | ✅ | ❌ |
| Смотреть билеты | ❌ | 🔸 | ✅ (все) |
| Отменить билет | ❌ | 🔸 | ✅ (при отмене рейса) |
| Смотреть свой аккаунт | ❌ | ✅ | ✅ |
| Управлять станциями, поездами, местами | ❌ | ❌ | ✅ |
| Управлять маршрутами, ценами, рейсами | ❌ | ❌ | ✅ |

### 4.3 Как проверяются права

```
Запрос ─► authenticate ─► requireRole ─► проверка владельца ─► действие
           (кто ты?)      (твоя роль?)   (это твой билет?)
```

1. **authenticate** — читает cookie с токеном. Нет токена → `401`.
2. **requireRole('ADMIN')** — для `/api/admin/*`. Роль не ADMIN → `403`.
3. **Проверка владельца** — в каждом запросе к билету добавляется условие `user_id = текущий пользователь`. Чужой билет → `404` (не говорим, что такой билет вообще есть).

---

## 5. Архитектура системы

### 5.1 Почему монолит

**Монолит** — это одно приложение, в котором находится весь сервер. Для учебного проекта это лучший выбор:

- один проект, одна команда запуска;
- одна база данных — легко делать транзакции (важно для бронирования);
- проще отлаживать и разворачивать.

Чтобы монолит не превратился в «кашу», код делится на **модули** (auth, trips, tickets…) и **слои** (controller, service, repository).

### 5.2 Общая структура

```mermaid
flowchart TD
    U["Пользователь в браузере"] --> FE["Frontend: React SPA"]
    FE -- "HTTP запросы /api/... (JSON)" --> BE
    subgraph BE["Backend: Node.js + Express (один процесс)"]
        ST["Раздача статики<br/>(собранный React)"]
        MW["Middleware<br/>безопасность, вход, роли, проверка данных"]
        CT["Controllers<br/>приём запросов"]
        SV["Services<br/>бизнес-логика"]
        RP["Repositories<br/>запросы к БД"]
        MW --> CT --> SV --> RP
    end
    RP -- "SQL" --> DB[("PostgreSQL")]
```

Та же схема текстом:

```
┌─────────────────────────────── Браузер ───────────────────────────────┐
│  React SPA: страницы, формы, React Query, AuthContext                 │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTPS: /api/... (JSON + cookie)
┌───────────────────────────────▼───────────────────────────────────────┐
│                     Node.js + Express (монолит)                       │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐   │
│  │   Статика    │  │ Middleware: helmet, cors, authenticate,      │   │
│  │ client/dist  │  │ requireRole, validate, errorHandler          │   │
│  └──────────────┘  └───────────────────────┬──────────────────────┘   │
│                    ┌───────────────────────▼──────────────────────┐   │
│                    │ Controllers: auth, stations, trains, routes, │   │
│                    │ trips, tickets, admin                        │   │
│                    └───────────────────────┬──────────────────────┘   │
│                    ┌───────────────────────▼──────────────────────┐   │
│                    │ Services: поиск, места, бронирование, отмена │   │
│                    └───────────────────────┬──────────────────────┘   │
│                    ┌───────────────────────▼──────────────────────┐   │
│                    │ Repositories: SQL-запросы                    │   │
│                    └───────────────────────┬──────────────────────┘   │
└────────────────────────────────────────────┼──────────────────────────┘
                                             │ SQL (транзакции)
                                  ┌──────────▼──────────┐
                                  │  PostgreSQL 16      │
                                  │  10 таблиц          │
                                  └─────────────────────┘
```

### 5.3 Путь одного запроса (пример: бронирование)

1. Пассажир нажимает «Подтвердить» → React отправляет `POST /api/tickets`.
2. **Middleware** проверяет, что пассажир вошёл, и что данные в запросе правильные.
3. **Controller** берёт данные и вызывает `ticketsService.bookTicket()`.
4. **Service** проверяет правила (рейс существует, станции в правильном порядке, место есть), считает цену.
5. **Repository** делает `INSERT` в таблицу `tickets` внутри транзакции.
6. **PostgreSQL** проверяет, что место не занято (ограничение `EXCLUDE`), и сохраняет билет.
7. Ответ идёт обратно: `201 Created` + билет → React показывает страницу билета.

---

## 6. Технологический стек

### 6.1 Основное

| Часть | Технология | Версия | Зачем |
| --- | --- | --- | --- |
| Язык | TypeScript | 5.x | Один язык на фронте и бэке, меньше ошибок благодаря типам |
| Frontend | React | 18 | Интерфейс сайта |
| Сборщик frontend | Vite | 5 | Быстрый запуск и сборка |
| Backend | Node.js | 20 LTS | Сервер |
| Веб-фреймворк | Express | 4 | Маршруты API, middleware |
| База данных | PostgreSQL | 16 | Надёжное хранение, транзакции, защита от двойной продажи |

### 6.2 Библиотеки Frontend

| Библиотека | Зачем |
| --- | --- |
| react-router-dom | Переходы между страницами |
| @tanstack/react-query | Загрузка данных с сервера, кэш, обновление после брони |
| react-hook-form | Формы (регистрация, поиск, админка) |
| zod | Проверка данных формы |
| axios | Отправка запросов на сервер |
| tailwindcss | Стили, адаптивная вёрстка |
| date-fns | Форматирование дат и времени |

### 6.3 Библиотеки Backend

| Библиотека | Зачем |
| --- | --- |
| express | Сервер и маршруты |
| prisma | Работа с БД, миграции |
| zod | Проверка входящих данных |
| bcrypt | Хэширование паролей |
| jsonwebtoken | Токены входа (JWT) |
| cookie-parser | Чтение cookie |
| helmet | Защитные HTTP-заголовки |
| cors | Разрешённые источники запросов |
| express-rate-limit | Ограничение частоты запросов (защита от подбора пароля) |
| pino, pino-http | Логи |
| dotenv | Настройки из файла `.env` |

### 6.4 Инструменты

| Инструмент | Зачем |
| --- | --- |
| Docker, docker-compose | Запуск PostgreSQL и всего приложения одной командой |
| Vitest | Unit и интеграционные тесты |
| Supertest | Тесты API |
| React Testing Library | Тесты компонентов |
| Playwright | E2E-тесты (как будто пользователь кликает в браузере) |
| ESLint + Prettier | Единый стиль кода |
| GitHub Actions | Автоматический запуск тестов (CI) |
| Git + GitHub | Хранение кода |

---

## 7. Архитектура Backend

### 7.1 Три слоя

| Слой | Что делает | Чего НЕ делает |
| --- | --- | --- |
| **Controller** | Принимает запрос, достаёт параметры, вызывает сервис, отправляет ответ | Не содержит правил и SQL |
| **Service** | Вся бизнес-логика: проверки, расчёты, транзакции | Не знает про `req`/`res` |
| **Repository** | Только запросы к базе данных | Не содержит правил |

Почему так: правила лежат в одном месте (service), их легко тестировать и менять.

### 7.2 Модули

| Модуль | Что внутри | Основные функции сервиса |
| --- | --- | --- |
| **auth** | Регистрация, вход, выход, текущий пользователь | `register`, `login`, `getMe` |
| **stations** | Станции | `list`, `create`, `update` |
| **trains** | Поезда и места | `createTrain`, `updateTrain`, `generateSeats`, `updateSeat` |
| **routes** | Маршруты, остановки, цены | `createRoute`, `updateStops`, `setFares` |
| **trips** | Рейсы на даты, поиск, места | `createTrips`, `search`, `getTrip`, `getSeatMap`, `updateTrip`, `cancelTrip` |
| **tickets** | Бронирование, мои билеты, отмена | `bookTicket`, `listMyTickets`, `getMyTicket`, `cancelTicket` |
| **admin** | Просмотр всех бронирований | `listAllTickets` |
| **audit** | Журнал действий | `log` |

### 7.3 Структура папок

```
traintix/
├── client/                         # FRONTEND (React)
│   ├── src/
│   │   ├── api/                    # функции запросов к серверу
│   │   ├── components/             # кнопки, карточки, сетка мест…
│   │   ├── pages/                  # страницы
│   │   ├── context/                # AuthContext (кто вошёл)
│   │   ├── hooks/                  # свои хуки (useAuth, useSeatMap…)
│   │   ├── utils/                  # форматирование дат, цен
│   │   ├── App.tsx                 # маршруты страниц
│   │   └── main.tsx                # точка входа
│   ├── index.html
│   └── vite.config.ts
│
├── server/                         # BACKEND (Node.js)
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts       # какие URL есть
│   │   │   │   ├── auth.controller.ts   # приём запросов
│   │   │   │   ├── auth.service.ts      # логика
│   │   │   │   ├── auth.repository.ts   # запросы к БД
│   │   │   │   └── auth.schema.ts       # правила проверки данных (zod)
│   │   │   ├── stations/   (те же 5 файлов)
│   │   │   ├── trains/
│   │   │   ├── routes/
│   │   │   ├── trips/
│   │   │   ├── tickets/
│   │   │   ├── admin/
│   │   │   └── audit/
│   │   ├── middleware/
│   │   │   ├── authenticate.ts     # проверка входа
│   │   │   ├── requireRole.ts      # проверка роли
│   │   │   ├── validate.ts         # проверка данных запроса
│   │   │   └── errorHandler.ts     # единая обработка ошибок
│   │   ├── db/
│   │   │   └── client.ts           # подключение к PostgreSQL
│   │   ├── utils/
│   │   │   ├── AppError.ts         # класс ошибки
│   │   │   ├── ticketNumber.ts     # генерация номера билета
│   │   │   └── logger.ts           # логгер
│   │   ├── config.ts               # чтение .env
│   │   ├── app.ts                  # сборка Express
│   │   └── server.ts               # запуск сервера
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts                 # тестовые данные
│   └── tests/
│
├── shared/                         # общие типы и схемы zod
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

### 7.4 Пример: как выглядит один модуль

**tickets.routes.ts** — какие адреса есть:

```ts
const router = Router();
router.use(authenticate);                                   // все адреса только для вошедших
router.post('/', validate(bookTicketSchema), controller.book);
router.get('/', controller.listMine);
router.get('/:id', controller.getMine);
router.post('/:id/cancel', controller.cancel);
export default router;
```

**tickets.controller.ts** — приём запроса:

```ts
export async function book(req: Request, res: Response) {
  const ticket = await ticketsService.bookTicket(req.user.id, req.body);
  res.status(201).json(ticket);
}
```

**tickets.service.ts** — логика (полностью в разделе 10.4).

**tickets.repository.ts** — запрос к БД:

```ts
export function insertTicket(tx: Tx, data: NewTicket) {
  return tx.ticket.create({ data });
}
```

### 7.5 Подключение всего вместе (app.ts)

```ts
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.use('/api/auth', authRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/admin', authenticate, requireRole('ADMIN'), adminRoutes);

app.use(express.static('client/dist'));                       // сайт
app.get('*', (_, res) => res.sendFile('client/dist/index.html')); // SPA
app.use(errorHandler);                                        // всегда последним
```

---

## 8. Проектирование базы данных

### 8.1 Главная идея

Данные делятся на **три группы**:

| Группа | Таблицы | Что хранит |
| --- | --- | --- |
| Пользователи | `users`, `audit_log` | Кто пользуется системой и что делал админ |
| Справочники и шаблоны | `stations`, `trains`, `seats`, `routes`, `route_stops`, `fares` | Станции, поезда, места, маршрут «в общем виде», цены |
| Рейсы и билеты | `trips`, `trip_stops`, `tickets` | Конкретные поездки на конкретные даты и проданные билеты |

**Почему маршрут и рейс — разные вещи?**

- **Маршрут** (`routes` + `route_stops`) — это шаблон: «T101 едет Prague → Brno → Vienna, отправление в 07:00, до Brno 2,5 часа».
- **Рейс** (`trips` + `trip_stops`) — это конкретная поездка: «T101, 5 декабря 2026, Prague 07:00 → Brno 09:30 → Vienna 11:00».

Билет привязан к **рейсу**. Поэтому если админ поменяет шаблон маршрута, уже проданные билеты не сломаются.

**Как хранится участок билета.** Не названиями станций, а **номерами остановок**: билет Prague → Brno = остановки `0 → 1`. Так проверка пересечения — простое сравнение чисел.

### 8.2 Структурная схема базы данных (ER-диаграмма)

```mermaid
erDiagram
    USERS ||--o{ TICKETS : "покупает"
    USERS ||--o{ AUDIT_LOG : "совершает действия"
    TRAINS ||--o{ SEATS : "имеет места"
    TRAINS ||--o{ ROUTES : "ходит по маршрутам"
    TRAINS ||--o{ TRIPS : "выполняет рейсы"
    ROUTES ||--|{ ROUTE_STOPS : "состоит из остановок"
    ROUTES ||--o{ FARES : "имеет цены"
    ROUTES ||--o{ TRIPS : "превращается в рейсы"
    STATIONS ||--o{ ROUTE_STOPS : "используется в"
    STATIONS ||--o{ TRIP_STOPS : "используется в"
    TRIPS ||--|{ TRIP_STOPS : "имеет расписание"
    TRIPS ||--o{ TICKETS : "имеет билеты"
    SEATS ||--o{ TICKETS : "занимается билетом"

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        varchar password_hash
        enum role "PASSENGER или ADMIN"
        timestamptz created_at
    }
    STATIONS {
        bigint id PK
        varchar code UK "PRG"
        varchar name "Prague"
        varchar city
        varchar timezone "Europe/Prague"
        boolean is_active
    }
    TRAINS {
        bigint id PK
        varchar number UK "T101"
        varchar name
        boolean is_active
    }
    SEATS {
        bigint id PK
        bigint train_id FK
        smallint carriage_no "номер вагона"
        varchar seat_label "12A"
        varchar seat_class "необязательно"
        boolean is_active
    }
    ROUTES {
        bigint id PK
        bigint train_id FK
        varchar name
        time departure_time "время старта 07:00"
        varchar timezone
        boolean is_active
    }
    ROUTE_STOPS {
        bigint id PK
        bigint route_id FK
        bigint station_id FK
        smallint stop_order "0,1,2..."
        int arrival_offset_min "минут от старта"
        int departure_offset_min "минут от старта"
    }
    FARES {
        bigint id PK
        bigint route_id FK
        smallint from_stop_order
        smallint to_stop_order
        numeric price
        char currency "EUR"
    }
    TRIPS {
        bigint id PK
        bigint route_id FK
        bigint train_id FK
        date service_date
        enum status "SCHEDULED или CANCELLED"
        boolean schedule_changed
    }
    TRIP_STOPS {
        bigint trip_id PK,FK
        smallint stop_order PK
        bigint station_id FK
        timestamptz arrival_at
        timestamptz departure_at
    }
    TICKETS {
        bigint id PK
        varchar ticket_number UK "TTX-7F3K9Q2M"
        bigint user_id FK
        bigint trip_id FK
        bigint seat_id FK
        smallint from_stop_order
        smallint to_stop_order
        numeric price
        enum status "CONFIRMED или CANCELLED"
        timestamptz created_at
        timestamptz cancelled_at
    }
    AUDIT_LOG {
        bigint id PK
        bigint user_id FK
        varchar action
        varchar entity
        bigint entity_id
        jsonb details
        timestamptz created_at
    }
```

### 8.3 Та же схема текстом (связи)

```
  СПРАВОЧНИКИ И ШАБЛОНЫ                          РЕЙСЫ И БИЛЕТЫ
  ─────────────────────                          ──────────────

  ┌──────────┐ 1      N ┌──────────┐
  │  trains  │─────────►│  seats   │──────────────────────────┐
  └────┬─────┘          └──────────┘                          │ 1
       │ 1                                                    │
       │ N                                                    │ N
  ┌────▼─────┐ 1      N ┌──────────┐ 1      N ┌──────────┐ 1  ▼  N ┌──────────┐
  │  routes  │─────────►│  trips   │─────────►│ tickets  │◄────────│  users   │
  └─┬──────┬─┘          └────┬─────┘          └──────────┘   1     └────┬─────┘
    │ 1    │ 1               │ 1                                        │ 1
    │ N    │ N               │ N                                        │ N
┌───▼───┐┌─▼──────────┐ ┌────▼───────┐                            ┌─────▼─────┐
│ fares ││route_stops │ │ trip_stops │                            │ audit_log │
└───────┘└─────┬──────┘ └────┬───────┘                            └───────────┘
               │ N           │ N
               │ 1           │ 1
             ┌─▼─────────────▼─┐
             │    stations     │
             └─────────────────┘

  Билет (tickets) связан с тремя таблицами:
      user_id  → users   (кто купил)
      trip_id  → trips   (какой рейс)
      seat_id  → seats   (какое место)
  + from_stop_order / to_stop_order → номера остановок в trip_stops этого рейса

Кратко:
  trains   1 ── N  seats         (у поезда много мест)
  trains   1 ── N  routes        (поезд может ходить по нескольким маршрутам)
  routes   1 ── N  route_stops   (маршрут = список остановок)
  routes   1 ── N  fares         (цены между парами остановок)
  routes   1 ── N  trips         (маршрут на каждую дату = рейс)
  trains   1 ── N  trips         (рейс выполняет конкретный поезд)
  users    1 ── N  audit_log     (кто что сделал)
  trips    1 ── N  trip_stops    (расписание рейса с точным временем)
  trips    1 ── N  tickets       (билеты на рейс)
  seats    1 ── N  tickets       (одно место — много билетов на разные участки/даты)
  users    1 ── N  tickets       (у пассажира много билетов)
  stations 1 ── N  route_stops / trip_stops
```

### 8.4 Описание таблиц

#### Таблица `users` — пользователи

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | Уникальный номер (PK) |
| name | VARCHAR(100) | ✅ | Имя пассажира |
| email | VARCHAR(255) | ✅ | Email, уникальный, хранится в нижнем регистре |
| password_hash | VARCHAR(255) | ✅ | Хэш пароля (bcrypt), сам пароль не хранится |
| role | user_role | ✅ | `PASSENGER` (по умолчанию) или `ADMIN` |
| created_at | TIMESTAMPTZ | ✅ | Дата регистрации |

#### Таблица `stations` — станции

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| code | VARCHAR(10) | ✅ | Короткий код, уникальный (`PRG`) |
| name | VARCHAR(100) | ✅ | Название (`Prague`) |
| city | VARCHAR(100) | | Город |
| timezone | VARCHAR(50) | ✅ | Часовой пояс станции (`Europe/Prague`) — чтобы показывать местное время |
| is_active | BOOLEAN | ✅ | Можно ли использовать станцию в новых маршрутах |

#### Таблица `trains` — поезда

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| number | VARCHAR(20) | ✅ | Номер поезда, уникальный (`T101`) |
| name | VARCHAR(100) | | Название («Moravia Express») |
| is_active | BOOLEAN | ✅ | Активен ли поезд |

#### Таблица `seats` — места в поезде

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| train_id | BIGINT | ✅ | FK → `trains.id` |
| carriage_no | SMALLINT | ✅ | Номер вагона (> 0) |
| seat_label | VARCHAR(10) | ✅ | Номер места (`12A`) |
| seat_class | VARCHAR(20) | | Класс (на будущее) |
| is_active | BOOLEAN | ✅ | Продаётся ли место. Места **не удаляются**, только выключаются |

Уникальность: `(train_id, carriage_no, seat_label)` — в одном вагоне не может быть двух мест 12A.

#### Таблица `routes` — маршруты (шаблон)

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| train_id | BIGINT | ✅ | FK → `trains.id` |
| name | VARCHAR(150) | ✅ | «Prague – Vienna утренний» |
| departure_time | TIME | ✅ | Время отправления с первой станции (`07:00`) |
| timezone | VARCHAR(50) | ✅ | Часовой пояс, в котором задано `departure_time` |
| is_active | BOOLEAN | ✅ | Можно ли создавать новые рейсы |

#### Таблица `route_stops` — остановки маршрута

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| route_id | BIGINT | ✅ | FK → `routes.id` |
| station_id | BIGINT | ✅ | FK → `stations.id` |
| stop_order | SMALLINT | ✅ | Порядок: 0, 1, 2… |
| arrival_offset_min | INT | | Через сколько минут после старта поезд **приходит** сюда (у первой — пусто) |
| departure_offset_min | INT | | Через сколько минут после старта поезд **уходит** отсюда (у последней — пусто) |

Пример для T101:

| stop_order | Станция | arrival_offset_min | departure_offset_min |
| --- | --- | --- | --- |
| 0 | Prague | — | 0 |
| 1 | Brno | 150 | 155 |
| 2 | Vienna | 240 | — |

#### Таблица `fares` — цены

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| route_id | BIGINT | ✅ | FK → `routes.id` |
| from_stop_order | SMALLINT | ✅ | Откуда (номер остановки) |
| to_stop_order | SMALLINT | ✅ | Куда (номер остановки), всегда больше `from` |
| price | NUMERIC(10,2) | ✅ | Цена (≥ 0) |
| currency | CHAR(3) | ✅ | Валюта (`EUR`) |

Пример для T101: `0→1 = 19.00`, `1→2 = 15.00`, `0→2 = 29.00`.
Для маршрута из N остановок нужно задать N·(N−1)/2 цен (для 3 остановок — 3 цены).

#### Таблица `trips` — рейсы (конкретная дата)

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| route_id | BIGINT | ✅ | FK → `routes.id` |
| train_id | BIGINT | ✅ | FK → `trains.id` |
| service_date | DATE | ✅ | Дата отправления с первой станции |
| status | trip_status | ✅ | `SCHEDULED` или `CANCELLED` |
| schedule_changed | BOOLEAN | ✅ | `true`, если админ менял время после продаж |
| cancel_reason | VARCHAR(255) | | Причина отмены рейса |

Уникальность: `(route_id, service_date)` — один маршрут один раз в день.

#### Таблица `trip_stops` — расписание рейса

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| trip_id | BIGINT | ✅ | FK → `trips.id` |
| stop_order | SMALLINT | ✅ | Порядок остановки |
| station_id | BIGINT | ✅ | FK → `stations.id` |
| arrival_at | TIMESTAMPTZ | | Точное время прибытия |
| departure_at | TIMESTAMPTZ | | Точное время отправления |

Первичный ключ: `(trip_id, stop_order)`. Заполняется автоматически при создании рейса (алгоритм 10.1).

#### Таблица `tickets` — билеты

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| ticket_number | VARCHAR(20) | ✅ | Уникальный номер билета (`TTX-7F3K9Q2M`) |
| user_id | BIGINT | ✅ | FK → `users.id` — владелец |
| trip_id | BIGINT | ✅ | FK → `trips.id` — рейс |
| seat_id | BIGINT | ✅ | FK → `seats.id` — место |
| from_stop_order | SMALLINT | ✅ | Номер остановки посадки |
| to_stop_order | SMALLINT | ✅ | Номер остановки выхода (> from) |
| price | NUMERIC(10,2) | ✅ | Цена на момент покупки |
| currency | CHAR(3) | ✅ | Валюта |
| status | ticket_status | ✅ | `CONFIRMED` или `CANCELLED` |
| passenger_name | VARCHAR(100) | ✅ | Копия имени на момент покупки |
| train_number | VARCHAR(20) | ✅ | Копия номера поезда |
| carriage_no | SMALLINT | ✅ | Копия номера вагона |
| seat_label | VARCHAR(10) | ✅ | Копия номера места |
| from_station_name | VARCHAR(100) | ✅ | Копия названия станции посадки |
| to_station_name | VARCHAR(100) | ✅ | Копия названия станции выхода |
| created_at | TIMESTAMPTZ | ✅ | Когда куплен |
| cancelled_at | TIMESTAMPTZ | | Когда отменён |
| cancelled_by | user_role | | Кто отменил: `PASSENGER` или `ADMIN` |

**Зачем копии?** Чтобы билет всегда показывал то, что было куплено, даже если потом админ переименует станцию или поменяет цену. Время отправления/прибытия **не копируется** — оно берётся из `trip_stops`, чтобы пассажир видел актуальное время, если расписание изменили.

#### Таблица `audit_log` — журнал действий

| Поле | Тип | Обязательно | Описание |
| --- | --- | :---: | --- |
| id | BIGSERIAL | ✅ | PK |
| user_id | BIGINT | | Кто сделал |
| action | VARCHAR(50) | ✅ | `TICKET_BOOKED`, `TICKET_CANCELLED`, `TRIP_CANCELLED`, `ROUTE_UPDATED`… |
| entity | VARCHAR(30) | ✅ | Тип объекта (`ticket`, `trip`, `route`…) |
| entity_id | BIGINT | | ID объекта |
| details | JSONB | | Подробности (что было / что стало) |
| created_at | TIMESTAMPTZ | ✅ | Когда |

### 8.5 Ограничения (правила, которые проверяет сама база)

| Таблица | Ограничение | Зачем |
| --- | --- | --- |
| users | `email UNIQUE` | Один email — один аккаунт |
| stations | `code UNIQUE` | Без дублей станций |
| trains | `number UNIQUE` | Без дублей поездов |
| seats | `UNIQUE (train_id, carriage_no, seat_label)` | Без дублей мест |
| route_stops | `UNIQUE (route_id, stop_order)` | Один порядковый номер — одна остановка |
| route_stops | `UNIQUE (route_id, station_id)` | Станция не повторяется в маршруте |
| fares | `CHECK (from_stop_order < to_stop_order)` | Цена только «вперёд» |
| fares | `CHECK (price >= 0)` | Нет отрицательных цен |
| trips | `UNIQUE (route_id, service_date)` | Нет двух одинаковых рейсов |
| tickets | `ticket_number UNIQUE` | Уникальный номер билета |
| tickets | `CHECK (from_stop_order < to_stop_order)` | Нельзя ехать назад |
| tickets | **`EXCLUDE … WHERE status='CONFIRMED'`** | **Одно место нельзя продать дважды на пересекающиеся участки** (раздел 14) |

### 8.6 Индексы (для скорости)

| Индекс | Ускоряет |
| --- | --- |
| `trip_stops (station_id, trip_id)` | Поиск рейсов, проходящих через станцию |
| `trips (service_date, status)` | Отбор рейсов по дате |
| `tickets (trip_id, seat_id)` | Проверка занятости мест |
| `tickets (user_id, created_at DESC)` | Список «Мои билеты» |
| GiST-индекс от `EXCLUDE` | Проверка пересечений (создаётся автоматически) |

### 8.7 Полный SQL создания базы

```sql
-- расширение нужно для EXCLUDE с обычными числами
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role     AS ENUM ('PASSENGER', 'ADMIN');
CREATE TYPE trip_status   AS ENUM ('SCHEDULED', 'CANCELLED');
CREATE TYPE ticket_status AS ENUM ('CONFIRMED', 'CANCELLED');

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'PASSENGER',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE stations (
  id        BIGSERIAL PRIMARY KEY,
  code      VARCHAR(10)  NOT NULL UNIQUE,
  name      VARCHAR(100) NOT NULL,
  city      VARCHAR(100),
  timezone  VARCHAR(50)  NOT NULL DEFAULT 'Europe/Prague',
  is_active BOOLEAN      NOT NULL DEFAULT true
);

CREATE TABLE trains (
  id        BIGSERIAL PRIMARY KEY,
  number    VARCHAR(20) NOT NULL UNIQUE,
  name      VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE seats (
  id          BIGSERIAL PRIMARY KEY,
  train_id    BIGINT NOT NULL REFERENCES trains(id),
  carriage_no SMALLINT NOT NULL CHECK (carriage_no > 0),
  seat_label  VARCHAR(10) NOT NULL,
  seat_class  VARCHAR(20),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (train_id, carriage_no, seat_label)
);

CREATE TABLE routes (
  id             BIGSERIAL PRIMARY KEY,
  train_id       BIGINT NOT NULL REFERENCES trains(id),
  name           VARCHAR(150) NOT NULL,
  departure_time TIME NOT NULL,
  timezone       VARCHAR(50) NOT NULL DEFAULT 'Europe/Prague',
  is_active      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE route_stops (
  id                   BIGSERIAL PRIMARY KEY,
  route_id             BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  station_id           BIGINT NOT NULL REFERENCES stations(id),
  stop_order           SMALLINT NOT NULL CHECK (stop_order >= 0),
  arrival_offset_min   INT CHECK (arrival_offset_min >= 0),
  departure_offset_min INT CHECK (departure_offset_min >= 0),
  UNIQUE (route_id, stop_order),
  UNIQUE (route_id, station_id),
  CHECK (arrival_offset_min IS NULL OR departure_offset_min IS NULL
         OR departure_offset_min >= arrival_offset_min)
);

CREATE TABLE fares (
  id              BIGSERIAL PRIMARY KEY,
  route_id        BIGINT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  from_stop_order SMALLINT NOT NULL,
  to_stop_order   SMALLINT NOT NULL,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'EUR',
  CHECK (from_stop_order < to_stop_order),
  UNIQUE (route_id, from_stop_order, to_stop_order)
);

CREATE TABLE trips (
  id               BIGSERIAL PRIMARY KEY,
  route_id         BIGINT NOT NULL REFERENCES routes(id),
  train_id         BIGINT NOT NULL REFERENCES trains(id),
  service_date     DATE NOT NULL,
  status           trip_status NOT NULL DEFAULT 'SCHEDULED',
  schedule_changed BOOLEAN NOT NULL DEFAULT false,
  cancel_reason    VARCHAR(255),
  UNIQUE (route_id, service_date)
);

CREATE TABLE trip_stops (
  trip_id      BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_order   SMALLINT NOT NULL,
  station_id   BIGINT NOT NULL REFERENCES stations(id),
  arrival_at   TIMESTAMPTZ,
  departure_at TIMESTAMPTZ,
  PRIMARY KEY (trip_id, stop_order)
);

CREATE TABLE tickets (
  id                BIGSERIAL PRIMARY KEY,
  ticket_number     VARCHAR(20) NOT NULL UNIQUE,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  trip_id           BIGINT NOT NULL REFERENCES trips(id),
  seat_id           BIGINT NOT NULL REFERENCES seats(id),
  from_stop_order   SMALLINT NOT NULL,
  to_stop_order     SMALLINT NOT NULL,
  price             NUMERIC(10,2) NOT NULL,
  currency          CHAR(3) NOT NULL,
  status            ticket_status NOT NULL DEFAULT 'CONFIRMED',
  passenger_name    VARCHAR(100) NOT NULL,
  train_number      VARCHAR(20)  NOT NULL,
  carriage_no       SMALLINT     NOT NULL,
  seat_label        VARCHAR(10)  NOT NULL,
  from_station_name VARCHAR(100) NOT NULL,
  to_station_name   VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  cancelled_at      TIMESTAMPTZ,
  cancelled_by      user_role,
  CHECK (from_stop_order < to_stop_order),

  -- ГЛАВНОЕ ПРАВИЛО: на одном рейсе одно место не может иметь
  -- два ПОДТВЕРЖДЁННЫХ билета с пересекающимися участками
  CONSTRAINT no_double_booking EXCLUDE USING gist (
    trip_id WITH =,
    seat_id WITH =,
    int4range(from_stop_order, to_stop_order) WITH &&
  ) WHERE (status = 'CONFIRMED')
);

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  action     VARCHAR(50) NOT NULL,
  entity     VARCHAR(30) NOT NULL,
  entity_id  BIGINT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_stops_station ON trip_stops (station_id, trip_id);
CREATE INDEX idx_trips_date         ON trips (service_date, status);
CREATE INDEX idx_tickets_trip_seat  ON tickets (trip_id, seat_id);
CREATE INDEX idx_tickets_user       ON tickets (user_id, created_at DESC);
```

> **Важно про Prisma.** Prisma не умеет описывать `EXCLUDE`. Поэтому после `prisma migrate dev --create-only`
> нужно вручную дописать блок `EXCLUDE` в SQL-файл миграции, затем применить её.

### 8.8 Пример данных (что лежит в базе для T101)

```
stations:     1 PRG Prague | 2 BRN Brno | 3 VIE Vienna
trains:       1 T101
seats:        вагоны 1–3, в каждом места 1A,1B,1C,1D … 10A–10D  (120 мест)
routes:       1 "Prague – Vienna", train 1, departure_time 07:00
route_stops:  (0, Prague, —, 0) (1, Brno, 150, 155) (2, Vienna, 240, —)
fares:        0→1 19.00 | 1→2 15.00 | 0→2 29.00
trips:        42  route 1, 2026-12-05, SCHEDULED
trip_stops:   (42,0,Prague,—,07:00) (42,1,Brno,09:30,09:35) (42,2,Vienna,11:00,—)
tickets:      901 TTX-7F3K9Q2M, user 5, trip 42, seat 12A, 0→1, 19.00, CONFIRMED
```

---

## 9. Проектирование API

### 9.1 Общие правила

| Правило | Значение |
| --- | --- |
| Адрес | Все запросы начинаются с `/api` |
| Формат | JSON (`Content-Type: application/json`) |
| Вход | JWT-токен в cookie `token` (ставится сервером автоматически) |
| Даты | `YYYY-MM-DD` (например `2026-12-05`) |
| Время | ISO 8601 в UTC (`2026-12-05T06:00:00Z`) |
| Деньги | Строка с 2 знаками + валюта: `{ "amount": "19.00", "currency": "EUR" }` |
| Списки | Параметры `page` (с 1) и `limit` (по умолчанию 20, максимум 100) |
| Ошибки | Всегда в одном формате (см. 9.6) |

### 9.2 Список всех endpoints

| # | Метод | Адрес | Кто может | Что делает |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/auth/register` | Все | Регистрация |
| 2 | POST | `/api/auth/login` | Все | Вход |
| 3 | POST | `/api/auth/logout` | Вошедший | Выход |
| 4 | GET | `/api/auth/me` | Вошедший | Мой аккаунт |
| 5 | GET | `/api/stations` | Все | Список станций |
| 6 | GET | `/api/trips/search` | Все | Поиск рейсов |
| 7 | GET | `/api/trips/:id` | Все | Рейс и его остановки |
| 8 | GET | `/api/trips/:id/seats` | Все | Места и их доступность на участке |
| 9 | POST | `/api/tickets` | Пассажир | Забронировать |
| 10 | GET | `/api/tickets` | Пассажир | Мои билеты |
| 11 | GET | `/api/tickets/:id` | Владелец | Один билет |
| 12 | POST | `/api/tickets/:id/cancel` | Владелец | Отменить билет |
| 13 | GET | `/api/admin/stations` | Админ | Все станции |
| 14 | POST | `/api/admin/stations` | Админ | Создать станцию |
| 15 | PATCH | `/api/admin/stations/:id` | Админ | Изменить станцию |
| 16 | GET | `/api/admin/trains` | Админ | Все поезда |
| 17 | POST | `/api/admin/trains` | Админ | Создать поезд |
| 18 | PATCH | `/api/admin/trains/:id` | Админ | Изменить поезд |
| 19 | GET | `/api/admin/trains/:id/seats` | Админ | Места поезда |
| 20 | POST | `/api/admin/trains/:id/seats/generate` | Админ | Создать места пачкой |
| 21 | PATCH | `/api/admin/seats/:id` | Админ | Включить/выключить место |
| 22 | GET | `/api/admin/routes` | Админ | Все маршруты |
| 23 | POST | `/api/admin/routes` | Админ | Создать маршрут с остановками |
| 24 | GET | `/api/admin/routes/:id` | Админ | Маршрут, остановки, цены |
| 25 | PUT | `/api/admin/routes/:id/stops` | Админ | Изменить остановки |
| 26 | PUT | `/api/admin/routes/:id/fares` | Админ | Задать цены |
| 27 | GET | `/api/admin/trips` | Админ | Рейсы (фильтр по дате, маршруту) |
| 28 | POST | `/api/admin/trips` | Админ | Создать рейсы на даты |
| 29 | PATCH | `/api/admin/trips/:id/schedule` | Админ | Изменить время рейса |
| 30 | POST | `/api/admin/trips/:id/cancel` | Админ | Отменить рейс |
| 31 | GET | `/api/admin/tickets` | Админ | Все бронирования |

### 9.3 Аутентификация

#### 1. `POST /api/auth/register` — регистрация

Запрос:

```json
{ "name": "Anna Novak", "email": "anna@example.com", "password": "secret123" }
```

| Поле | Правило |
| --- | --- |
| name | 2–100 символов |
| email | правильный email |
| password | минимум 8 символов, есть буква и цифра |

Ответ `201 Created` (и сразу ставится cookie — пользователь вошёл):

```json
{ "id": 5, "name": "Anna Novak", "email": "anna@example.com", "role": "PASSENGER" }
```

Ошибки: `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.

#### 2. `POST /api/auth/login` — вход

Запрос: `{ "email": "anna@example.com", "password": "secret123" }`
Ответ `200`: то же, что при регистрации + cookie `token`.
Ошибки: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `429 TOO_MANY_REQUESTS`.

#### 3. `POST /api/auth/logout` — выход

Ответ `204 No Content`, cookie удаляется.

#### 4. `GET /api/auth/me` — мой аккаунт

Ответ `200`:

```json
{ "id": 5, "name": "Anna Novak", "email": "anna@example.com", "role": "PASSENGER", "createdAt": "2026-11-20T10:00:00Z" }
```

Ошибка: `401 UNAUTHENTICATED`.

### 9.4 Поиск и рейсы

#### 5. `GET /api/stations`

Ответ `200`: `[{ "id": 1, "code": "PRG", "name": "Prague", "city": "Prague" }, …]` (только активные).

#### 6. `GET /api/trips/search?from=1&to=2&date=2026-12-05`

| Параметр | Обязательно | Описание |
| --- | :---: | --- |
| from | ✅ | ID станции отправления |
| to | ✅ | ID станции прибытия |
| date | ✅ | Дата отправления со станции `from` |

Ответ `200`:

```json
{
  "items": [
    {
      "tripId": 42,
      "trainNumber": "T101",
      "from": { "stationId": 1, "name": "Prague", "stopOrder": 0, "departureAt": "2026-12-05T06:00:00Z" },
      "to":   { "stationId": 2, "name": "Brno",   "stopOrder": 1, "arrivalAt":   "2026-12-05T08:30:00Z" },
      "durationMinutes": 150,
      "price": { "amount": "19.00", "currency": "EUR" },
      "freeSeats": 119,
      "hasSeats": true
    }
  ]
}
```

Нет рейсов → `200` и `"items": []`.
Ошибки: `400 VALIDATION_ERROR`, `400 SAME_STATIONS`, `404 STATION_NOT_FOUND`.

#### 7. `GET /api/trips/:id?from=0&to=1`

`from`, `to` — номера остановок (необязательны; если переданы — в ответе будет цена участка).

Ответ `200`:

```json
{
  "tripId": 42,
  "trainNumber": "T101",
  "date": "2026-12-05",
  "status": "SCHEDULED",
  "scheduleChanged": false,
  "stops": [
    { "stopOrder": 0, "stationId": 1, "name": "Prague", "arrivalAt": null,                   "departureAt": "2026-12-05T06:00:00Z" },
    { "stopOrder": 1, "stationId": 2, "name": "Brno",   "arrivalAt": "2026-12-05T08:30:00Z", "departureAt": "2026-12-05T08:35:00Z" },
    { "stopOrder": 2, "stationId": 3, "name": "Vienna", "arrivalAt": "2026-12-05T10:00:00Z", "departureAt": null }
  ],
  "selected": { "from": 0, "to": 1, "price": { "amount": "19.00", "currency": "EUR" } }
}
```

Ошибки: `404 NOT_FOUND`, `400 INVALID_JOURNEY`.

#### 8. `GET /api/trips/:id/seats?from=0&to=1`

`from` и `to` обязательны.

Ответ `200`:

```json
{
  "tripId": 42, "from": 0, "to": 1,
  "carriages": [
    {
      "carriageNo": 1,
      "seats": [
        { "seatId": 101, "label": "1A", "available": true },
        { "seatId": 102, "label": "1B", "available": false }
      ]
    }
  ]
}
```

Ошибки: `404 NOT_FOUND`, `400 INVALID_JOURNEY`.

### 9.5 Билеты

#### 9. `POST /api/tickets` — бронирование

Запрос:

```json
{ "tripId": 42, "seatId": 112, "fromStopOrder": 0, "toStopOrder": 1, "expectedPrice": "19.00" }
```

`expectedPrice` — цена, которую видел пассажир. Если цена изменилась — бронь не делается.

Ответ `201 Created`:

```json
{
  "id": 901,
  "ticketNumber": "TTX-7F3K9Q2M",
  "status": "CONFIRMED",
  "passengerName": "Anna Novak",
  "trainNumber": "T101",
  "date": "2026-12-05",
  "from": { "name": "Prague", "departureAt": "2026-12-05T06:00:00Z" },
  "to":   { "name": "Brno",   "arrivalAt":   "2026-12-05T08:30:00Z" },
  "seat": { "carriageNo": 3, "label": "12A" },
  "price": { "amount": "19.00", "currency": "EUR" },
  "displayStatus": "UPCOMING",
  "canCancel": true,
  "createdAt": "2026-11-20T10:15:00Z"
}
```

Ошибки:

| Код | Когда |
| --- | --- |
| 400 VALIDATION_ERROR | Неправильные поля |
| 400 INVALID_JOURNEY | Остановок нет на рейсе или `from >= to` |
| 401 UNAUTHENTICATED | Не вошёл |
| 404 NOT_FOUND | Нет рейса или места |
| 409 SEAT_UNAVAILABLE | Место уже занято на этом участке |
| 409 PRICE_CHANGED | Цена изменилась |
| 409 ALREADY_DEPARTED | Поезд уже ушёл со станции посадки |
| 409 TRIP_CANCELLED | Рейс отменён |

#### 10. `GET /api/tickets?status=upcoming`

`status` = `upcoming` | `completed` | `cancelled` (необязательно — без него все). Плюс `page`, `limit`.

Ответ `200`: `{ "items": [ …билеты как в п.9… ], "page": 1, "total": 3 }`

#### 11. `GET /api/tickets/:id`

Ответ `200`: билет как в п.9. Чужой или несуществующий → `404 NOT_FOUND`.

#### 12. `POST /api/tickets/:id/cancel`

Ответ `200`: билет со `"status": "CANCELLED"`, `"cancelledAt": "…"`.
Ошибки: `404 NOT_FOUND`, `409 ALREADY_CANCELLED`, `409 ALREADY_DEPARTED`.

### 9.6 Администратор

#### 14. `POST /api/admin/stations`

```json
{ "code": "PRG", "name": "Prague", "city": "Prague", "timezone": "Europe/Prague" }
```

Ответ `201` — станция. Ошибки: `400`, `409 DUPLICATE` (код занят).
`PATCH /api/admin/stations/:id` — те же поля (любые) + `isActive`.

#### 17. `POST /api/admin/trains`

```json
{ "number": "T101", "name": "Moravia Express" }
```

#### 20. `POST /api/admin/trains/:id/seats/generate` — создать места пачкой

```json
{ "carriages": 3, "rows": 10, "letters": ["A", "B", "C", "D"] }
```

Создаст 3 × 10 × 4 = 120 мест: `1A…10D` в вагонах 1–3. Уже существующие места пропускаются.

#### 21. `PATCH /api/admin/seats/:id`

```json
{ "isActive": false }
```

Если на место есть будущие подтверждённые билеты → `409 HAS_CONFIRMED_TICKETS` + список билетов.

#### 23. `POST /api/admin/routes` — маршрут

```json
{
  "trainId": 1,
  "name": "Prague – Vienna",
  "departureTime": "07:00",
  "timezone": "Europe/Prague",
  "stops": [
    { "stationId": 1, "arrivalOffsetMin": null, "departureOffsetMin": 0 },
    { "stationId": 2, "arrivalOffsetMin": 150,  "departureOffsetMin": 155 },
    { "stationId": 3, "arrivalOffsetMin": 240,  "departureOffsetMin": null }
  ]
}
```

Порядок в массиве `stops` = порядок остановок (`stop_order` ставится автоматически 0, 1, 2…).

Проверки: минимум 2 остановки; станции не повторяются; время каждой следующей остановки больше предыдущей.

#### 26. `PUT /api/admin/routes/:id/fares` — цены

```json
{
  "currency": "EUR",
  "fares": [
    { "from": 0, "to": 1, "price": "19.00" },
    { "from": 1, "to": 2, "price": "15.00" },
    { "from": 0, "to": 2, "price": "29.00" }
  ]
}
```

Ответ `200` + `"missing": []` — список пар без цены (если что-то не заполнено).

#### 28. `POST /api/admin/trips` — создать рейсы

```json
{ "routeId": 1, "dateFrom": "2026-12-01", "dateTo": "2026-12-14", "weekdays": [1,2,3,4,5,6,7] }
```

Создаст рейс на каждый подходящий день. Даты, где рейс уже есть, пропускаются.
Ответ `201`: `{ "created": 14, "skipped": 0 }`.

#### 29. `PATCH /api/admin/trips/:id/schedule` — изменить время

```json
{ "stops": [ { "stopOrder": 1, "arrivalAt": "2026-12-05T08:40:00Z", "departureAt": "2026-12-05T08:45:00Z" } ], "confirm": false }
```

Если есть проданные билеты и `confirm=false` → `409 HAS_CONFIRMED_TICKETS` с количеством билетов. Админ видит предупреждение и повторяет с `confirm=true`.

#### 30. `POST /api/admin/trips/:id/cancel`

```json
{ "reason": "Технические работы на путях", "confirm": true }
```

Все подтверждённые билеты рейса становятся `CANCELLED` (`cancelled_by = ADMIN`).

#### 31. `GET /api/admin/tickets?tripId=&status=&date=&email=`

Ответ `200`: `{ "items": [ { …билет…, "userEmail": "anna@example.com" } ], "page": 1, "total": 57 }`

### 9.7 Формат ошибки

Все ошибки выглядят одинаково:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Это место уже занято на выбранном участке. Выберите другое место.",
    "details": null
  }
}
```

Для ошибок валидации `details` — список полей:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Проверьте введённые данные",
  "details": [ { "field": "email", "message": "Неверный формат email" } ] } }
```

Полная таблица кодов — в [разделе 13](#13-обработка-ошибок).

---

## 10. Бизнес-логика

### 10.1 Алгоритм: создание рейсов из маршрута

**Задача:** админ выбирает маршрут и даты → система создаёт рейсы с точным временем.

```mermaid
flowchart TD
    A["Админ: маршрут + диапазон дат"] --> B{"Маршрут активен<br/>и у всех пар есть цены?"}
    B -- нет --> E1["Ошибка: заполните цены"]
    B -- да --> C["Для каждой даты D в диапазоне"]
    C --> D{"Рейс на D уже есть?"}
    D -- да --> S["Пропустить"]
    D -- нет --> F["Создать trips"]
    F --> G["start = D + departure_time в часовом поясе маршрута"]
    G --> H["Для каждой остановки:<br/>arrival_at = start + arrival_offset<br/>departure_at = start + departure_offset"]
    H --> I["Сохранить trip_stops"]
    I --> C
```

Шаги:

1. Проверить, что маршрут активен и для всех пар остановок заданы цены.
2. Для каждой даты `D` от `dateFrom` до `dateTo` (если день недели подходит):
   1. Если рейс `(route_id, D)` уже есть — пропустить.
   2. Создать запись в `trips`.
   3. Вычислить время старта: `start = D + departure_time` (в часовом поясе маршрута, перевести в UTC).
   4. Для каждой остановки маршрута записать в `trip_stops`:
      `arrival_at = start + arrival_offset_min минут`, `departure_at = start + departure_offset_min минут`.
3. Всё делается в одной транзакции.

Пример: маршрут стартует в 07:00, Brno: прибытие +150 мин, отправление +155 мин → 5 декабря Brno: прибытие 09:30, отправление 09:35.

### 10.2 Алгоритм: поиск рейсов

**Задача:** найти поезда, которые проходят через станцию A, потом через станцию B, в нужную дату.

```mermaid
flowchart TD
    A["Запрос: from, to, date"] --> B{"from = to?"}
    B -- да --> E1["400 SAME_STATIONS"]
    B -- нет --> C{"Станции существуют?"}
    C -- нет --> E2["404 STATION_NOT_FOUND"]
    C -- да --> D["Найти рейсы, где есть остановка from И остановка to"]
    D --> F["Оставить те, где номер from меньше номера to"]
    F --> G["Оставить те, где дата отправления со станции from = date<br/>и рейс SCHEDULED и ещё не ушёл"]
    G --> H["Для каждого: цена из fares, длительность, кол-во свободных мест"]
    H --> I["Отсортировать по времени отправления"]
    I --> J["Вернуть список (может быть пустым)"]
```

Шаги простыми словами:

1. Если станции одинаковые → ошибка.
2. Берём все рейсы, у которых в `trip_stops` есть **обе** станции.
3. Оставляем только те, где станция `from` идёт **раньше** станции `to` (`from.stop_order < to.stop_order`). Так поезд Vienna → Prague не попадёт в выдачу, если поезд едет Prague → Vienna (сценарий F).
4. Оставляем рейсы, у которых **поезд уходит со станции `from` в выбранную дату** (по местному времени станции), статус `SCHEDULED`, и время отправления ещё не прошло.
5. Для каждого рейса считаем:
   - цену — из `fares` по паре `(from_stop_order, to_stop_order)`;
   - длительность — `arrival_at(to) − departure_at(from)`;
   - сколько свободных мест на этом участке (алгоритм 11).
6. Сортируем по времени отправления.

SQL:

```sql
SELECT t.id                    AS trip_id,
       tr.number               AS train_number,
       fs.stop_order           AS from_order,
       ts.stop_order           AS to_order,
       fs.departure_at,
       ts.arrival_at,
       EXTRACT(EPOCH FROM (ts.arrival_at - fs.departure_at)) / 60 AS duration_min,
       f.price, f.currency,
       (SELECT COUNT(*) FROM seats s
         WHERE s.train_id = t.train_id AND s.is_active
           AND NOT EXISTS (
             SELECT 1 FROM tickets k
              WHERE k.trip_id = t.id AND k.seat_id = s.id
                AND k.status = 'CONFIRMED'
                AND k.from_stop_order < ts.stop_order
                AND fs.stop_order < k.to_stop_order)
       )                       AS free_seats
FROM trips t
JOIN trains tr     ON tr.id = t.train_id
JOIN trip_stops fs ON fs.trip_id = t.id AND fs.station_id = $1   -- откуда
JOIN trip_stops ts ON ts.trip_id = t.id AND ts.station_id = $2   -- куда
JOIN stations sf   ON sf.id = fs.station_id
JOIN fares f       ON f.route_id = t.route_id
                  AND f.from_stop_order = fs.stop_order
                  AND f.to_stop_order   = ts.stop_order
WHERE t.status = 'SCHEDULED'
  AND fs.stop_order < ts.stop_order                               -- правильное направление
  AND (fs.departure_at AT TIME ZONE sf.timezone)::date = $3       -- дата по местному времени
  AND fs.departure_at > now()                                     -- ещё не ушёл
ORDER BY fs.departure_at;
```

### 10.3 Алгоритм: расчёт цены

1. Цена берётся из таблицы `fares` по `(route_id, from_stop_order, to_stop_order)`.
2. Цена всегда считается **на сервере**. Цене, присланной с сайта, не доверяем.
3. В билет записывается цена на момент покупки — если потом админ изменит цену, билет не изменится.
4. Если цены для пары нет — рейс не показывается в поиске.

### 10.4 Алгоритм: бронирование билета

```mermaid
flowchart TD
    A["POST /api/tickets"] --> B{"Пользователь вошёл?"}
    B -- нет --> E1["401 UNAUTHENTICATED"]
    B -- да --> C{"Данные правильные?"}
    C -- нет --> E2["400 VALIDATION_ERROR"]
    C -- да --> T["BEGIN транзакция"]
    T --> D{"Рейс есть и SCHEDULED?"}
    D -- нет --> E3["404 / 409 TRIP_CANCELLED"]
    D -- да --> F{"Остановки есть на рейсе<br/>и from меньше to?"}
    F -- нет --> E4["400 INVALID_JOURNEY"]
    F -- да --> G{"Поезд ещё не ушёл со станции from?"}
    G -- нет --> E5["409 ALREADY_DEPARTED"]
    G -- да --> H{"Место принадлежит поезду и активно?"}
    H -- нет --> E6["404 NOT_FOUND"]
    H -- да --> I["Взять цену из fares"]
    I --> J{"Цена = expectedPrice?"}
    J -- нет --> E7["409 PRICE_CHANGED"]
    J -- да --> K["Сгенерировать номер билета"]
    K --> L["INSERT в tickets"]
    L --> M{"База разрешила?<br/>EXCLUDE"}
    M -- "нет, пересечение" --> E8["ROLLBACK → 409 SEAT_UNAVAILABLE"]
    M -- да --> N["Запись в audit_log, COMMIT"]
    N --> O["201 + билет"]
```

Шаги:

1. Проверить вход и формат данных.
2. Открыть транзакцию.
3. Загрузить рейс. Нет → 404. Отменён → 409.
4. Найти в `trip_stops` остановки `from` и `to`. Нет или `from >= to` → 400.
5. Проверить `departure_at(from) > now()`. Иначе → 409 `ALREADY_DEPARTED`.
6. Проверить, что место принадлежит поезду рейса и `is_active = true`.
7. Найти цену. Если отличается от `expectedPrice` → 409 `PRICE_CHANGED`.
8. Сгенерировать уникальный номер билета (10.6).
9. Вставить билет. Если база вернула ошибку `23P01` (пересечение) → отменить транзакцию, вернуть 409 `SEAT_UNAVAILABLE`.
10. Записать событие в журнал, закрыть транзакцию, вернуть билет.

Код сервиса:

```ts
export async function bookTicket(userId: number, dto: BookTicketDto) {
  return db.$transaction(async (tx) => {
    // 1. рейс
    const trip = await tripsRepo.findById(tx, dto.tripId);
    if (!trip) throw new AppError(404, 'NOT_FOUND');
    if (trip.status === 'CANCELLED') throw new AppError(409, 'TRIP_CANCELLED');

    // 2. участок
    const from = trip.stops.find(s => s.stopOrder === dto.fromStopOrder);
    const to   = trip.stops.find(s => s.stopOrder === dto.toStopOrder);
    if (!from || !to || from.stopOrder >= to.stopOrder)
      throw new AppError(400, 'INVALID_JOURNEY');
    if (from.departureAt <= new Date()) throw new AppError(409, 'ALREADY_DEPARTED');

    // 3. место
    const seat = await seatsRepo.findById(tx, dto.seatId);
    if (!seat || seat.trainId !== trip.trainId || !seat.isActive)
      throw new AppError(404, 'NOT_FOUND');

    // 4. цена
    const fare = await faresRepo.find(tx, trip.routeId, from.stopOrder, to.stopOrder);
    if (!fare) throw new AppError(400, 'INVALID_JOURNEY');
    if (dto.expectedPrice && fare.price !== dto.expectedPrice)
      throw new AppError(409, 'PRICE_CHANGED', undefined, { newPrice: fare.price });

    // 5. сохранить
    const user = await usersRepo.findById(tx, userId);
    try {
      const ticket = await ticketsRepo.insert(tx, {
        ticketNumber: generateTicketNumber(),
        userId, tripId: trip.id, seatId: seat.id,
        fromStopOrder: from.stopOrder, toStopOrder: to.stopOrder,
        price: fare.price, currency: fare.currency,
        passengerName: user.name, trainNumber: trip.trainNumber,
        carriageNo: seat.carriageNo, seatLabel: seat.seatLabel,
        fromStationName: from.stationName, toStationName: to.stationName,
      });
      await auditRepo.log(tx, userId, 'TICKET_BOOKED', 'ticket', ticket.id);
      return toTicketDto(ticket, from, to);
    } catch (e) {
      if (isPgError(e, '23P01')) throw new AppError(409, 'SEAT_UNAVAILABLE');
      throw e;
    }
  });
}
```

### 10.5 Алгоритм: отмена билета пассажиром

```mermaid
flowchart TD
    A["POST /api/tickets/:id/cancel"] --> B{"Билет есть<br/>и принадлежит пользователю?"}
    B -- нет --> E1["404 NOT_FOUND"]
    B -- да --> C{"Статус CONFIRMED?"}
    C -- нет --> E2["409 ALREADY_CANCELLED"]
    C -- да --> D{"Сейчас раньше, чем<br/>отправление со станции посадки?"}
    D -- нет --> E3["409 ALREADY_DEPARTED"]
    D -- да --> F["status = CANCELLED<br/>cancelled_at = now()<br/>cancelled_by = PASSENGER"]
    F --> G["Место снова свободно<br/>(EXCLUDE больше не учитывает билет)"]
    G --> H["200 + билет"]
```

Отмена — один безопасный запрос (если два раза нажать «Отменить», второй ничего не сделает):

```sql
UPDATE tickets k
   SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = 'PASSENGER'
  FROM trip_stops s
 WHERE k.id = $1
   AND k.user_id = $2
   AND k.status = 'CONFIRMED'
   AND s.trip_id = k.trip_id AND s.stop_order = k.from_stop_order
   AND s.departure_at > now()
RETURNING k.*;
```

Если обновлено 0 строк — сервис отдельно смотрит, почему (нет билета / уже отменён / уже уехал), и возвращает нужную ошибку.

**Почему место освобождается само?** Правило `EXCLUDE` действует только на билеты со статусом `CONFIRMED`. Отменённый билет в проверке не участвует — место сразу можно купить снова на этот и любой пересекающийся участок (сценарий D). Билет **не удаляется** — он остаётся в истории.

### 10.6 Алгоритм: номер билета

1. Формат: `TTX-` + 8 символов.
2. Символы: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (без похожих `0/O`, `1/I`).
3. Случайность из `crypto.randomBytes` (не `Math.random`).
4. В базе `UNIQUE` — если вдруг совпадёт (почти невозможно), повторить генерацию до 3 раз.

```ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateTicketNumber(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `TTX-${code}`;
}
```

### 10.7 Статусы билета

В базе только **два** статуса. «Предстоящий» и «Завершённый» вычисляются по времени.

```mermaid
stateDiagram-v2
    [*] --> CONFIRMED : бронирование
    CONFIRMED --> CANCELLED : отмена пассажиром (до отправления)
    CONFIRMED --> CANCELLED : отмена рейса админом
    CANCELLED --> [*]
    note right of CONFIRMED
        до отправления = «Предстоящий»
        после отправления = «Завершённый»
    end note
```

| Что видит пассажир | Условие |
| --- | --- |
| Предстоящий | `CONFIRMED` и отправление со станции посадки ещё не наступило |
| Завершённый | `CONFIRMED` и отправление уже было |
| Отменён | `CANCELLED` |

### 10.8 Алгоритм: изменения администратора и проданные билеты

**Правило:** админ не может «тихо» испортить купленный билет. Любое изменение, которое касается проданных билетов, либо **запрещено**, либо требует **явного подтверждения**.

```mermaid
flowchart TD
    A["Админ сохраняет изменение"] --> B{"Затрагивает рейсы<br/>с подтверждёнными билетами?"}
    B -- нет --> OK["Сохранить"]
    B -- да --> C{"Тип изменения"}
    C -- "Удалить остановку / выключить место / удалить поезд" --> X["409 HAS_CONFIRMED_TICKETS<br/>+ список билетов"]
    C -- "Изменить время рейса / отменить рейс" --> D{"confirm = true?"}
    D -- нет --> W["409 + сколько билетов затронуто<br/>(админ видит предупреждение)"]
    D -- да --> Y["Сохранить, пометить рейс,<br/>записать в audit_log"]
```

| Действие админа | Что происходит |
| --- | --- |
| Изменить шаблон маршрута или цену | Разрешено. Действует только на **новые** рейсы и **новые** продажи. Старые билеты не меняются |
| Изменить время конкретного рейса | Если есть билеты — нужно `confirm=true`. Рейс помечается `schedule_changed = true`, пассажир видит «Расписание изменено» |
| Удалить остановку из рейса | Если есть билеты через эту остановку — **запрещено** |
| Выключить место | Если есть будущие билеты на это место — **запрещено** |
| Удалить поезд, место, станцию | **Не поддерживается** вообще. Только выключение (`is_active = false`) |
| Отменить рейс | Нужно `confirm=true`. Все билеты → `CANCELLED`, `cancelled_by = ADMIN`, пассажир видит причину |

---

## 11. Алгоритм доступности мест

### 11.1 Идея

Место не «занято вообще» — оно занято **на определённых участках**.
Маршрут делится на участки между соседними остановками:

```
Остановки:     0 Prague      1 Brno       2 Vienna
                  │────────────│────────────│
Участки:            участок 0     участок 1
```

Билет `from → to` занимает участки от `from` до `to − 1`.
Записывается как **полуоткрытый интервал** `[from, to)` — «от `from` включительно до `to` не включая».

| Билет | Интервал | Занимает участки |
| --- | --- | --- |
| Prague → Brno | [0, 1) | 0 |
| Brno → Vienna | [1, 2) | 1 |
| Prague → Vienna | [0, 2) | 0 и 1 |

### 11.2 Правило пересечения

Два билета на **одно место одного рейса** конфликтуют, если их интервалы пересекаются:

```
Пересекаются, если:   A.from < B.to   И   B.from < A.to
```

Наглядно (место 12A):

```
              0 Prague      1 Brno       2 Vienna
Билет A:         [██████████)                          Prague → Brno
Билет B:                     [██████████)              Brno → Vienna     ✅ можно (стык в Brno — не пересечение)
Билет C:         [██████████████████████)              Prague → Vienna   ❌ нельзя (пересекается с A и B)
```

Проверка по формуле:

| Пара | Расчёт | Результат |
| --- | --- | --- |
| A [0,1) и B [1,2) | 0 < 2 ✔, 1 < 1 ✘ | Не пересекаются ✅ |
| A [0,1) и C [0,2) | 0 < 2 ✔, 0 < 1 ✔ | Пересекаются ❌ |
| B [1,2) и C [0,2) | 1 < 2 ✔, 0 < 2 ✔ | Пересекаются ❌ |

**Почему полуоткрытый интервал?** Пассажир A выходит в Brno, а пассажир B в Brno садится. Это одно и то же место в одно время, но не конфликт — A уже вышел. Полуоткрытый интервал это правильно учитывает.

### 11.3 Функция проверки (в коде)

```ts
/** true, если участки [aFrom, aTo) и [bFrom, bTo) пересекаются */
export function segmentsOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo;
}
```

### 11.4 Алгоритм: карта мест для участка

**Задача:** показать все места поезда и для каждого сказать — свободно ли оно на участке `[from, to)`.

```mermaid
flowchart TD
    A["Запрос: tripId, from, to"] --> B{"Остановки есть на рейсе<br/>и from меньше to?"}
    B -- нет --> E["400 INVALID_JOURNEY"]
    B -- да --> C["Взять все активные места поезда"]
    C --> D["Взять все CONFIRMED билеты этого рейса"]
    D --> F["Для каждого места:<br/>есть ли билет на это место,<br/>который пересекается с from..to?"]
    F -- есть --> G["available = false"]
    F -- нет --> H["available = true"]
    G --> I["Сгруппировать по вагонам"]
    H --> I
    I --> J["Вернуть карту мест"]
```

Шаги:

1. Проверить, что `from` и `to` — остановки рейса и `from < to`.
2. Взять все **активные** места поезда.
3. Взять все **подтверждённые** билеты этого рейса.
4. Место **свободно**, если среди билетов на это место **нет ни одного**, который пересекается с `[from, to)`.
5. Сгруппировать места по вагонам и отсортировать.

SQL (одним запросом):

```sql
SELECT s.id AS seat_id, s.carriage_no, s.seat_label,
       NOT EXISTS (
         SELECT 1 FROM tickets k
          WHERE k.trip_id = $1
            AND k.seat_id = s.id
            AND k.status = 'CONFIRMED'
            AND k.from_stop_order < $3     -- k.from < to
            AND $2 < k.to_stop_order       -- from < k.to
       ) AS available
FROM seats s
JOIN trips t ON t.id = $1 AND t.train_id = s.train_id
WHERE s.is_active
ORDER BY s.carriage_no, s.seat_label;
-- $1 = tripId, $2 = from, $3 = to
```

### 11.5 Все сценарии из требований

| Сценарий | Что уже куплено на 12A | Что пытаемся | Результат |
| --- | --- | --- | --- |
| A — промежуточная станция | — | Найти Prague → Brno | Поезд T101 найден, хотя он едет до Vienna |
| B — повторное использование места | Prague → Brno [0,1) | Brno → Vienna [1,2) | ✅ Успех |
| C — пересечение | Prague → Brno [0,1) | Prague → Vienna [0,2) | ❌ `SEAT_UNAVAILABLE` |
| D — отмена | Prague → Brno отменён | Prague → Vienna [0,2) | ✅ Успех |
| E — одновременно | — | Два человека одновременно | ✅ один, ❌ второй (раздел 14) |
| F — неверное направление | — | Найти Vienna → Prague | Поезд не показан |

---

## 12. Аутентификация и безопасность

### 12.1 Регистрация

```mermaid
flowchart TD
    A["name, email, password"] --> B{"Данные правильные?"}
    B -- нет --> E1["400 VALIDATION_ERROR"]
    B -- да --> C["email → нижний регистр"]
    C --> D{"Email уже есть?"}
    D -- да --> E2["409 EMAIL_TAKEN"]
    D -- нет --> F["hash = bcrypt(password, 12)"]
    F --> G["INSERT users (role = PASSENGER)"]
    G --> H["Создать JWT, положить в cookie"]
    H --> I["201 + данные пользователя"]
```

- Пароль никогда не хранится и не пишется в логи. Хранится только хэш bcrypt.
- Поле `role` из запроса игнорируется — всегда `PASSENGER`.

### 12.2 Вход

1. Найти пользователя по email (в нижнем регистре).
2. Сравнить пароль с хэшем через `bcrypt.compare`.
3. Если пользователя нет **или** пароль неверный — одна и та же ошибка `401 INVALID_CREDENTIALS` («Неверный email или пароль»). Так злоумышленник не узнает, какие email зарегистрированы.
4. Если всё верно — создать JWT и положить в cookie.

### 12.3 JWT и cookie

| Параметр | Значение |
| --- | --- |
| Содержимое токена | `{ sub: userId, role: "PASSENGER" }` |
| Подпись | Секрет `JWT_SECRET` из `.env` (длинная случайная строка) |
| Срок жизни | 7 дней |
| Где хранится | Cookie `token` |
| `httpOnly` | Да — JavaScript на странице не может прочитать токен (защита от XSS) |
| `secure` | Да в продакшене — только по HTTPS |
| `sameSite` | `lax` — защита от CSRF |

Middleware `authenticate`:

```ts
export function authenticate(req, res, next) {
  const token = req.cookies.token;
  if (!token) throw new AppError(401, 'UNAUTHENTICATED');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED');
  }
}

export const requireRole = (role: 'ADMIN') => (req, res, next) => {
  if (req.user?.role !== role) throw new AppError(403, 'FORBIDDEN');
  next();
};
```

### 12.4 Защита данных

| Угроза | Что это | Защита |
| --- | --- | --- |
| Чужие билеты | Пассажир подставляет чужой ID билета | Каждый запрос: `WHERE id = $1 AND user_id = текущий`. Чужой → 404 |
| Подмена пользователя | Отправить `userId` в теле запроса | `userId` берётся **только** из токена |
| SQL-инъекция | Вставить SQL-код в поле | Только параметризованные запросы (`$1`, ORM) |
| XSS | Вставить скрипт в имя | React экранирует текст; `dangerouslySetInnerHTML` не используется; helmet ставит CSP |
| CSRF | Чужой сайт отправляет запрос от имени пользователя | Cookie `sameSite=lax` + проверка заголовка `Origin` |
| Подбор пароля | Перебор паролей | Лимит: 10 попыток входа за 15 минут с одного IP |
| Подмена цены | Отправить свою цену | Цена всегда считается на сервере |
| Утечка через ошибки | Показать stack trace | Пользователь видит только `code` и `message` |
| Секреты в коде | Пароль БД в GitHub | Всё в `.env`, файл в `.gitignore` |
| Слабый пароль | `12345678` | Минимум 8 символов, буква + цифра |

---

## 13. Обработка ошибок

### 13.1 Как устроено

```
Service бросает AppError ─► Express ловит ─► errorHandler ─► JSON-ответ { error: {...} }
                                                    │
                                                    └─► лог (для 500 — с подробностями)
```

**Класс ошибки:**

```ts
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? MESSAGES[code] ?? 'Ошибка');
  }
}
```

**Единый обработчик:**

```ts
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: {
      code: 'VALIDATION_ERROR', message: 'Проверьте введённые данные',
      details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
  }
  if (err.code === '23P01') {           // EXCLUDE: пересечение
    return res.status(409).json({ error: { code: 'SEAT_UNAVAILABLE', message: MESSAGES.SEAT_UNAVAILABLE, details: null } });
  }
  if (err.code === '23505') {           // UNIQUE: дубль
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Такая запись уже существует', details: null } });
  }
  req.log.error({ err }, 'unexpected error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так. Попробуйте ещё раз.', details: null } });
}
```

> В Express 4 асинхронные ошибки не ловятся сами. Используйте пакет `express-async-errors`
> (одна строка `import 'express-async-errors'` в `app.ts`) или оборачивайте контроллеры.

### 13.2 Все коды ошибок

| HTTP | Код | Сообщение пользователю |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Проверьте введённые данные |
| 400 | SAME_STATIONS | Станции отправления и прибытия должны быть разными |
| 400 | INVALID_JOURNEY | Этот поезд не едет между выбранными станциями в этом направлении |
| 401 | UNAUTHENTICATED | Войдите в аккаунт, чтобы продолжить |
| 401 | INVALID_CREDENTIALS | Неверный email или пароль |
| 403 | FORBIDDEN | У вас нет доступа к этой странице |
| 404 | NOT_FOUND | Не найдено |
| 404 | STATION_NOT_FOUND | Станция не найдена |
| 409 | EMAIL_TAKEN | Этот email уже зарегистрирован |
| 409 | DUPLICATE | Такая запись уже существует |
| 409 | SEAT_UNAVAILABLE | Это место уже занято на выбранном участке. Выберите другое место |
| 409 | PRICE_CHANGED | Цена изменилась. Проверьте новую цену и подтвердите ещё раз |
| 409 | ALREADY_DEPARTED | Поезд уже отправился |
| 409 | ALREADY_CANCELLED | Билет уже отменён |
| 409 | TRIP_CANCELLED | Этот рейс отменён |
| 409 | HAS_CONFIRMED_TICKETS | На это уже проданы билеты. Изменение невозможно / требует подтверждения |
| 429 | TOO_MANY_REQUESTS | Слишком много попыток. Подождите несколько минут |
| 500 | INTERNAL_ERROR | Что-то пошло не так. Попробуйте ещё раз |

### 13.3 Сценарии ошибок: что видит пользователь

| Ситуация | Ответ сервера | Что делает сайт |
| --- | --- | --- |
| Выбрал одинаковые станции | — (проверка в форме) | Кнопка «Найти» неактивна, подсказка под полем |
| Поездов не найдено | 200, пустой список | «На эту дату поездов нет. Попробуйте другую дату» |
| Нажал «Подтвердить», не войдя | 401 | Переход на вход, потом обратно к брони |
| Место заняли, пока пассажир думал | 409 SEAT_UNAVAILABLE | Сообщение, карта мест обновляется, возврат к выбору места |
| Цена изменилась | 409 PRICE_CHANGED | Показать новую цену, кнопка «Подтвердить с новой ценой» |
| Поезд уже ушёл | 409 ALREADY_DEPARTED | Сообщение, кнопка «Отменить» скрыта |
| Открыл чужой билет по ссылке | 404 | Страница «Билет не найден» |
| Токен истёк | 401 | Выход из аккаунта, переход на вход |
| Сервер упал / нет интернета | 500 / сеть | «Что-то пошло не так» + кнопка «Повторить» |
| Админ выключает место с билетами | 409 HAS_CONFIRMED_TICKETS | Окно со списком билетов |

---

## 14. Конкурентное бронирование

### 14.1 Проблема

Два пассажира **одновременно** бронируют место 12A на пересекающиеся участки. Если делать «наивно»:

```
Время   Пассажир A                         Пассажир B
 t1     SELECT: место 12A свободно? → ДА
 t2                                        SELECT: место 12A свободно? → ДА
 t3     INSERT билет A
 t4                                        INSERT билет B
 ──►  Два билета на одно место!  ❌
```

Обе проверки прошли, потому что ни один из билетов ещё не был сохранён. Это называется **гонка (race condition)**.

### 14.2 Решение: правило в самой базе данных (EXCLUDE)

Мы не полагаемся на проверку в коде. Правило записано **в PostgreSQL**:

```sql
CONSTRAINT no_double_booking EXCLUDE USING gist (
  trip_id WITH =,                                    -- тот же рейс
  seat_id WITH =,                                    -- то же место
  int4range(from_stop_order, to_stop_order) WITH &&  -- участки пересекаются
) WHERE (status = 'CONFIRMED')                       -- только подтверждённые
```

Простыми словами: **«База не даст сохранить подтверждённый билет, если на этом рейсе на это место уже есть подтверждённый билет с пересекающимся участком».**

Как это работает при одновременных запросах:

```mermaid
sequenceDiagram
    participant A as Пассажир A
    participant B as Пассажир B
    participant API as Сервер
    participant DB as PostgreSQL
    A->>API: Бронь 12A, Prague→Brno
    B->>API: Бронь 12A, Prague→Vienna
    API->>DB: Транзакция A: INSERT
    API->>DB: Транзакция B: INSERT
    Note over DB: B ждёт, пока A закончит
    DB-->>API: A: COMMIT — успех
    API-->>A: 201 Билет TTX-7F3K9Q2M
    DB-->>API: B: ошибка 23P01 (пересечение)
    API-->>B: 409 SEAT_UNAVAILABLE
```

Текстом:

```
Время   Транзакция A                       Транзакция B
 t1     BEGIN; INSERT 12A [0,1)
 t2                                        BEGIN; INSERT 12A [0,2)
                                           ⏳ ждёт — A ещё не закончила
 t3     COMMIT  ✅
 t4                                        ❌ ошибка 23P01 → ROLLBACK
                                           → пассажиру B: «Место занято»
```

### 14.3 Почему именно так

| Способ | Плюсы | Минусы | Выбор |
| --- | --- | --- | --- |
| Только проверка в коде (SELECT, потом INSERT) | Просто | **Не защищает от гонки** | ❌ |
| `SELECT … FOR UPDATE` на места | Работает | Нужно блокировать правильные строки, легко ошибиться | Запасной вариант |
| Уровень изоляции `SERIALIZABLE` | Надёжно | Нужно повторять транзакции при ошибках | ❌ |
| **EXCLUDE-ограничение** | Работает всегда, даже если в коде ошибка; одна строка SQL | Нужно расширение `btree_gist` | ✅ **Выбрано** |

### 14.4 Транзакции

- Бронирование, отмена, создание рейсов, отмена рейса админом — **всегда в транзакции**.
- Если на любом шаге ошибка — `ROLLBACK`, в базе ничего не меняется.
- Уровень изоляции — стандартный `READ COMMITTED` (достаточно, т.к. защиту даёт EXCLUDE).

### 14.5 Другие ситуации одновременности

| Ситуация | Защита |
| --- | --- |
| Пассажир дважды нажал «Подтвердить» | Кнопка блокируется после нажатия; на сервере второй запрос получит `SEAT_UNAVAILABLE` (это же место уже его) |
| Два раза нажал «Отменить» | `UPDATE … WHERE status='CONFIRMED'` — второй раз обновит 0 строк → `ALREADY_CANCELLED` |
| Админ отменяет рейс, а пассажир в этот момент бронирует | Отмена рейса блокирует строку рейса (`SELECT … FOR UPDATE` на `trips`); бронирование тоже читает рейс с `FOR SHARE` — одно дождётся другого |
| Пассажир смотрит на старую карту мест | При ошибке `SEAT_UNAVAILABLE` сайт перезагружает карту мест |

### 14.6 Как проверить

Тест: 20 одновременных запросов на одно место и один участок.

```ts
it('только одна бронь из 20 одновременных', async () => {
  const requests = users.map(u =>
    request(app).post('/api/tickets').set('Cookie', u.cookie)
      .send({ tripId, seatId, fromStopOrder: 0, toStopOrder: 1 }));
  const results = await Promise.all(requests);
  expect(results.filter(r => r.status === 201)).toHaveLength(1);
  expect(results.filter(r => r.status === 409)).toHaveLength(19);
});
```

---

## 15. Логирование

### 15.1 Что используется

- Библиотека **pino** — пишет логи в формате JSON (одна строка = одно событие).
- **pino-http** — автоматически логирует каждый HTTP-запрос.
- Таблица **audit_log** — журнал важных действий (хранится в БД).

### 15.2 Уровни логов

| Уровень | Когда | Пример |
| --- | --- | --- |
| `error` | Неожиданная ошибка (500), БД недоступна | `unexpected error`, stack trace |
| `warn` | Ожидаемая, но важная проблема | Много неудачных входов, `SEAT_UNAVAILABLE` |
| `info` | Обычные события | Запуск сервера, бронь, отмена |
| `debug` | Подробности для разработки | SQL-запросы (только локально) |

В продакшене — уровень `info`, локально — `debug`.

### 15.3 Что логировать

| Событие | Уровень | Поля |
| --- | --- | --- |
| Каждый HTTP-запрос | info | requestId, метод, адрес, статус, время ответа (мс), userId |
| Регистрация | info | userId |
| Успешный вход | info | userId |
| Неудачный вход | warn | email (замаскирован: `a***@example.com`), IP |
| Бронирование | info | ticketId, tripId, seatId, from, to |
| Место занято (конфликт) | warn | tripId, seatId, from, to |
| Отмена билета | info | ticketId, кем отменён |
| Действие админа | info | что изменено |
| Ошибка 500 | error | requestId, stack trace |

**Никогда не логировать:** пароли, хэши паролей, JWT-токены, cookie.

Пример строки лога:

```json
{"level":"info","time":"2026-11-20T10:15:00Z","requestId":"b1f3…","userId":5,"msg":"ticket booked","ticketId":901,"tripId":42,"seatId":112,"from":0,"to":1}
```

### 15.4 requestId

Каждому запросу присваивается уникальный `requestId`. Он:
- пишется во все логи этого запроса;
- возвращается в заголовке ответа `X-Request-Id`.

Если пользователь сообщает об ошибке, по `requestId` можно найти все логи этого запроса.

### 15.5 Аудит (таблица audit_log)

Записываются действия, которые важно помнить:

| action | Когда |
| --- | --- |
| `TICKET_BOOKED` | Пассажир забронировал билет |
| `TICKET_CANCELLED` | Пассажир отменил билет |
| `STATION_CREATED` / `STATION_UPDATED` | Админ изменил станцию |
| `TRAIN_CREATED` / `TRAIN_UPDATED` / `SEATS_GENERATED` / `SEAT_UPDATED` | Админ изменил поезд или места |
| `ROUTE_CREATED` / `ROUTE_UPDATED` / `FARES_UPDATED` | Админ изменил маршрут или цены |
| `TRIPS_CREATED` / `TRIP_SCHEDULE_CHANGED` / `TRIP_CANCELLED` | Админ изменил рейсы |

Запись в `audit_log` делается **в той же транзакции**, что и само действие — если действие отменилось, записи тоже не будет.

---

## 16. Интеграции

### 16.1 Внешние системы

В версии 1.0 **внешних интеграций нет**: нет платёжных систем, нет железнодорожных API, нет отправки email. Все данные вводит администратор.

### 16.2 Взаимодействие компонентов

```mermaid
flowchart LR
    subgraph Browser["Браузер"]
        P["Страницы React"] --> Q["React Query"] --> AX["api/ (axios)"]
        AC["AuthContext"] --> AX
    end
    AX -- "HTTP JSON + cookie" --> R
    subgraph Server["Node.js"]
        R["Routes"] --> C["Controllers"] --> S["Services"] --> RP["Repositories"]
        S --> L["Logger / Audit"]
    end
    RP -- "SQL через пул соединений" --> DB[("PostgreSQL")]
    L --> DB
```

| Связь | Как общаются | Формат | Особенности |
| --- | --- | --- | --- |
| Браузер → Сервер | HTTPS-запросы | JSON | Cookie с токеном отправляется автоматически (`withCredentials: true`) |
| Сервер → Браузер | HTTP-ответы | JSON или HTML/JS (сайт) | Единый формат ошибок |
| Сервер → БД | SQL через пул соединений Prisma | SQL | До 10 соединений, транзакции |
| Модуль → модуль (внутри сервера) | Обычный вызов функций сервиса | TypeScript-объекты | Например, `tickets.service` вызывает `trips.repository` |

### 16.3 Пример: вход пользователя от начала до конца

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant FE as React
    participant BE as Express
    participant DB as PostgreSQL
    U->>FE: email + пароль, «Войти»
    FE->>BE: POST /api/auth/login
    BE->>DB: SELECT * FROM users WHERE email = $1
    DB-->>BE: пользователь + password_hash
    BE->>BE: bcrypt.compare
    BE-->>FE: 200 + Set-Cookie: token=...
    FE->>FE: AuthContext.user = ...
    FE-->>U: Переход на главную, в меню «Мои билеты»
```

### 16.4 Разработка: связь фронта и бэка

Во время разработки фронт (Vite, порт 5173) и бэк (Express, порт 3000) работают отдельно. Vite перенаправляет запросы `/api` на бэк:

```ts
// client/vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
});
```

В продакшене всё работает с одного адреса — Express отдаёт и сайт, и API.

### 16.5 Возможные интеграции в будущем

| Интеграция | Как добавить |
| --- | --- |
| Email-подтверждение брони | Библиотека `nodemailer` + SMTP; отправка после COMMIT брони |
| PDF-билет | Библиотека `pdfkit`, endpoint `GET /api/tickets/:id/pdf` |
| Оплата | Платёжный сервис (например Stripe): бронь со статусом «ожидает оплаты» + webhook |

---

## 17. Frontend

### 17.1 Страницы

| Адрес | Страница | Кто | Что на ней |
| --- | --- | --- | --- |
| `/` | Главная | Все | Форма поиска |
| `/register` | Регистрация | Гость | Имя, email, пароль, повтор пароля |
| `/login` | Вход | Гость | Email, пароль |
| `/search?from=&to=&date=` | Результаты поиска | Все | Карточки поездов |
| `/trips/:id?from=&to=` | Рейс и выбор места | Все | Остановки + карта мест |
| `/booking/review` | Проверка брони | Пассажир | Всё о брони + «Подтвердить» |
| `/tickets` | Мои билеты | Пассажир | 3 вкладки |
| `/tickets/:id` | Билет | Владелец | Полный билет + «Отменить» |
| `/account` | Аккаунт | Пассажир | Имя, email, дата регистрации |
| `/admin` | Админ: главная | Админ | Ссылки на разделы |
| `/admin/stations` | Станции | Админ | Таблица + форма |
| `/admin/trains` | Поезда | Админ | Таблица + форма |
| `/admin/trains/:id` | Поезд и места | Админ | Генератор мест, включение/выключение |
| `/admin/routes` | Маршруты | Админ | Список |
| `/admin/routes/:id` | Редактор маршрута | Админ | Остановки, время, таблица цен |
| `/admin/trips` | Рейсы | Админ | Создание на даты, изменение времени, отмена |
| `/admin/bookings` | Бронирования | Админ | Все билеты с фильтрами |
| `*` | 404 | Все | «Страница не найдена» |

### 17.2 Путь пассажира

```mermaid
flowchart LR
    H["Главная:<br/>форма поиска"] --> S["Результаты"]
    S --> T["Рейс:<br/>остановки + места"]
    T --> L{"Вошёл?"}
    L -- нет --> LG["Вход / Регистрация"] --> R
    L -- да --> R["Проверка брони"]
    R --> C{"POST /api/tickets"}
    C -- 201 --> TK["Страница билета"]
    C -- 409 место занято --> T
    TK --> MT["Мои билеты"]
    MT --> CN["Отмена"]
```

### 17.3 Как выглядят главные экраны (макеты)

**Главная / поиск**

```
┌──────────────────────────────────────────────────────────────┐
│  TrainTix                          Мои билеты   Аккаунт  Выйти│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Откуда  [ Prague        ▼]   ⇄   Куда [ Brno          ▼]   │
│   Дата    [ 05.12.2026     ]          [   Найти поезда   ]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Результаты поиска**

```
┌──────────────────────────────────────────────────────────────┐
│ Prague → Brno, 5 декабря 2026                                │
├──────────────────────────────────────────────────────────────┤
│ T101   07:00 ──── 2 ч 30 мин ────► 09:30    19.00 EUR        │
│        Есть места (119)                       [ Выбрать ]    │
├──────────────────────────────────────────────────────────────┤
│ T205   13:15 ──── 2 ч 20 мин ────► 15:35    21.00 EUR        │
│        Нет мест                               [ Выбрать ]✗   │
└──────────────────────────────────────────────────────────────┘
```

**Рейс и выбор места**

```
┌──────────────────────────────────────────────────────────────┐
│ T101 · 5 декабря 2026                                        │
│  ● Prague   07:00   ◄ посадка                                │
│  │                                                           │
│  ● Brno     09:30   ◄ выход                                  │
│  ┆                                                           │
│  ○ Vienna   11:00                                            │
├──────────────────────────────────────────────────────────────┤
│ Вагон  [1] [2] [3]                                           │
│   A  B     C  D                                              │
│  [1A][1B] [1C][1D]     [ ] свободно                          │
│  [2A][▓▓] [2C][2D]     [▓] занято                            │
│  [3A][3B] [■■][3D]     [■] выбрано                           │
│                                                              │
│ Выбрано: вагон 1, место 3C · 19.00 EUR       [ Далее ]       │
└──────────────────────────────────────────────────────────────┘
```

**Билет**

```
┌──────────────────────────────────────────────┐
│ Билет TTX-7F3K9Q2M            ✅ Подтверждён  │
├──────────────────────────────────────────────┤
│ Пассажир:  Anna Novak                        │
│ Поезд:     T101       Дата: 05.12.2026       │
│ Prague 07:00  ───────►  Brno 09:30           │
│ Вагон 1, место 3C                            │
│ Цена:      19.00 EUR                         │
├──────────────────────────────────────────────┤
│                        [ Отменить билет ]    │
└──────────────────────────────────────────────┘
```

### 17.4 Компоненты

```
App
├── AuthProvider                      (кто вошёл)
├── QueryClientProvider               (React Query)
└── Layout
    ├── Header / NavBar               (меню зависит от роли)
    ├── ErrorBoundary
    └── <Routes>
        ├── HomePage
        │   └── SearchForm
        │       └── StationSelect ×2
        ├── SearchResultsPage
        │   ├── TripCard ×N
        │   └── EmptyState
        ├── TripDetailsPage
        │   ├── StopsTimeline
        │   ├── CarriageTabs
        │   ├── SeatGrid
        │   │   └── SeatButton ×N
        │   └── SelectionBar
        ├── RequireAuth
        │   ├── BookingReviewPage
        │   │   └── BookingSummary
        │   ├── MyTicketsPage
        │   │   ├── Tabs
        │   │   └── TicketCard ×N
        │   ├── TicketDetailsPage
        │   │   ├── TicketView
        │   │   └── ConfirmDialog
        │   └── AccountPage
        └── RequireAdmin
            ├── AdminStationsPage   ─┐
            ├── AdminTrainsPage      │ DataTable + EntityForm
            ├── AdminRouteEditorPage │ + StopsEditor + FaresMatrix
            ├── AdminTripsPage       │
            └── AdminBookingsPage   ─┘
```

| Компонент | Что делает |
| --- | --- |
| SearchForm | Поля «откуда», «куда», «дата», кнопка «поменять местами», проверка одинаковых станций |
| StationSelect | Выпадающий список с поиском по названию |
| TripCard | Поезд, время, длительность, цена, есть ли места |
| StopsTimeline | Все остановки по порядку, свой участок выделен цветом |
| SeatGrid / SeatButton | Места по вагонам: свободно / занято / выбрано |
| BookingSummary | Всё о брони перед подтверждением |
| TicketCard / TicketView | Билет кратко / полностью |
| StatusBadge | «Предстоящий» / «Завершён» / «Отменён» |
| ConfirmDialog | «Вы уверены?» |
| ErrorMessage, EmptyState, Spinner, Toast | Ошибки, пустые списки, загрузка, уведомления |
| RequireAuth / RequireAdmin | Не пускают на страницу без входа / без роли админа |
| StopsEditor | Админ: добавить, удалить, переставить остановки, ввести время |
| FaresMatrix | Админ: таблица цен «откуда × куда» |

### 17.5 Состояние

| Что | Где хранится |
| --- | --- |
| Кто вошёл | `AuthContext` (загружается через `GET /api/auth/me` при открытии сайта) |
| Данные с сервера (рейсы, места, билеты) | React Query |
| Параметры поиска, выбранный участок | В адресе страницы (URL) — можно обновить страницу или поделиться ссылкой |
| Выбранное место перед подтверждением | `sessionStorage` (не теряется, если нужно войти) |
| Поля форм | react-hook-form |

### 17.6 Взаимодействие с API

Все запросы — в папке `client/src/api/`:

```ts
// api/client.ts
export const http = axios.create({ baseURL: '/api', withCredentials: true });

http.interceptors.response.use(
  r => r,
  err => {
    const apiError = err.response?.data?.error ?? { code: 'NETWORK', message: 'Нет связи с сервером' };
    if (err.response?.status === 401) authEvents.emit('logout');
    return Promise.reject(apiError);
  },
);

// api/trips.ts
export const searchTrips = (p: SearchParams) => http.get('/trips/search', { params: p }).then(r => r.data);
export const getSeatMap  = (id: number, from: number, to: number) =>
  http.get(`/trips/${id}/seats`, { params: { from, to } }).then(r => r.data);

// api/tickets.ts
export const bookTicket   = (b: BookTicketDto) => http.post('/tickets', b).then(r => r.data);
export const cancelTicket = (id: number) => http.post(`/tickets/${id}/cancel`).then(r => r.data);
```

Использование в компоненте:

```ts
const seatMap = useQuery({ queryKey: ['seats', tripId, from, to], queryFn: () => getSeatMap(tripId, from, to), staleTime: 0 });

const book = useMutation({
  mutationFn: bookTicket,
  onSuccess: (ticket) => { queryClient.invalidateQueries({ queryKey: ['tickets'] }); navigate(`/tickets/${ticket.id}`); },
  onError: (e: ApiError) => {
    if (e.code === 'SEAT_UNAVAILABLE') { toast.error(e.message); seatMap.refetch(); }
    else toast.error(e.message);
  },
});
```

| Действие на сайте | Запрос | После успеха |
| --- | --- | --- |
| Открыть сайт | `GET /auth/me` | Заполнить AuthContext |
| Поиск | `GET /trips/search` | Показать карточки |
| Открыть рейс | `GET /trips/:id`, `GET /trips/:id/seats` | Показать остановки и места |
| Подтвердить бронь | `POST /tickets` | Обновить `tickets` и `seats`, перейти к билету |
| Отменить | `POST /tickets/:id/cancel` | Обновить `tickets`, показать статус «Отменён» |

### 17.7 Удобство и доступность

- Адаптивная вёрстка: телефон (от 360 px), планшет, компьютер.
- Места — это кнопки `<button>` с подписью для экранного диктора: «Вагон 1, место 3C, свободно».
- У всех полей формы есть `<label>`.
- Время показывается по местному времени станции, в формате `07:00`, дата — `05.12.2026`.
- Во время загрузки — индикатор, кнопки блокируются.

---

## 18. Развёртывание

### 18.1 Окружения

| Окружение | Зачем | Где | База данных |
| --- | --- | --- | --- |
| **local** | Разработка | Компьютер разработчика | PostgreSQL в Docker |
| **test** | Автотесты | GitHub Actions | Временная PostgreSQL |
| **production** | Работающий сайт | Облачный хостинг (Render) | Управляемая PostgreSQL |

### 18.2 Схема продакшена

```
       Пользователь
            │ HTTPS
            ▼
┌───────────────────────────┐
│  Хостинг (Render)         │
│  ┌─────────────────────┐  │
│  │ Docker-контейнер     │  │
│  │ Node.js + Express    │  │
│  │ + собранный React    │  │
│  └──────────┬──────────┘  │
└─────────────┼─────────────┘
              │ DATABASE_URL (SSL)
              ▼
┌───────────────────────────┐
│ Управляемая PostgreSQL     │
│ + ежедневные бэкапы        │
└───────────────────────────┘
```

### 18.3 Переменные окружения (`.env`)

```bash
# .env.example — скопировать в .env и заполнить
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://traintix:traintix@localhost:5432/traintix
JWT_SECRET=замените-на-длинную-случайную-строку
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=debug
APP_TIMEZONE=Europe/Prague
```

| Переменная | Описание |
| --- | --- |
| NODE_ENV | `development` / `test` / `production` |
| PORT | Порт сервера |
| DATABASE_URL | Адрес базы данных |
| JWT_SECRET | Секрет для подписи токенов (минимум 32 символа) |
| JWT_EXPIRES_IN | Срок жизни токена |
| CORS_ORIGIN | Адрес фронта при разработке |
| LOG_LEVEL | Уровень логов |
| APP_TIMEZONE | Часовой пояс по умолчанию |

### 18.4 docker-compose.yml (локально)

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: traintix
      POSTGRES_PASSWORD: traintix
      POSTGRES_DB: traintix
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

### 18.5 Dockerfile (продакшен)

```dockerfile
# 1. Собираем React
FROM node:20 AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# 2. Собираем сервер
FROM node:20 AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npx prisma generate && npm run build

# 3. Итоговый образ
FROM node:20-slim
WORKDIR /app
COPY --from=server /app/server ./server
COPY --from=client /app/client/dist ./client/dist
WORKDIR /app/server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

### 18.6 Запуск локально — по шагам

```bash
# 1. Скачать проект
git clone <адрес-репозитория> traintix && cd traintix

# 2. Запустить базу данных
docker compose up -d db

# 3. Настроить сервер
cd server
cp ../.env.example .env
npm install
npx prisma migrate dev          # создать таблицы
npm run seed                    # тестовые данные + админ admin@traintix.local
npm run dev                     # сервер на http://localhost:3000

# 4. В другом терминале — сайт
cd client
npm install
npm run dev                     # сайт на http://localhost:5173
```

### 18.7 CI/CD (GitHub Actions)

```
push / pull request
   │
   ├─► 1. npm ci
   ├─► 2. lint (ESLint)
   ├─► 3. unit-тесты
   ├─► 4. интеграционные тесты (поднимается PostgreSQL)
   ├─► 5. сборка Docker-образа
   └─► 6. (только ветка main) деплой → prisma migrate deploy → запуск
```

### 18.8 Резервные копии

- Управляемая PostgreSQL делает бэкап каждый день, хранит 7 дней.
- Перед каждым изменением схемы (миграцией) в продакшене — ручной бэкап.

---

## 19. Тестирование

### 19.1 Уровни тестирования

```
            ▲  мало, медленные
           ╱ ╲
          ╱E2E╲          Playwright — как настоящий пользователь
         ╱─────╲
        ╱  API  ╲        Supertest — запросы к серверу + настоящая БД
       ╱─────────╲
      ╱Integration╲      Сервисы + БД
     ╱─────────────╲
    ╱     Unit      ╲    Vitest — отдельные функции
   ╱─────────────────╲
            ▼  много, быстрые
```

| Уровень | Инструмент | Что проверяем |
| --- | --- | --- |
| Unit | Vitest | `segmentsOverlap`, `generateTicketNumber`, расчёт статуса билета, расчёт времени рейса, валидация |
| Integration | Vitest + тестовая PostgreSQL | Сервисы с настоящей базой: бронь, отмена, EXCLUDE |
| API | Supertest | Все endpoints: коды ответов, формат, права доступа |
| Компоненты | React Testing Library | SearchForm, SeatGrid, BookingSummary, сообщения об ошибках |
| Функциональные (E2E) | Playwright | Полные сценарии в браузере |

### 19.2 Unit-тесты — примеры

```ts
describe('segmentsOverlap', () => {
  it('стык не пересечение', () => expect(segmentsOverlap(0, 1, 1, 2)).toBe(false));
  it('общий участок — пересечение', () => expect(segmentsOverlap(0, 2, 1, 2)).toBe(true));
  it('вложенный — пересечение', () => expect(segmentsOverlap(0, 3, 1, 2)).toBe(true));
  it('далеко — нет', () => expect(segmentsOverlap(0, 1, 2, 3)).toBe(false));
});
```

### 19.3 Тест-кейсы (функциональные и API)

| ID | Сценарий | Шаги | Ожидаемый результат | Требование |
| --- | --- | --- | --- | --- |
| TC-01 | Регистрация | POST register с верными данными | 201, cookie установлен | FR-01 |
| TC-02 | Повторный email | Зарегистрироваться дважды | 409 EMAIL_TAKEN | FR-01 |
| TC-03 | Вход с неверным паролем | POST login | 401 INVALID_CREDENTIALS | FR-02 |
| TC-04 | Поиск через промежуточную станцию | Поиск Prague → Brno (T101 едет до Vienna) | T101 в результатах | FR-06, сценарий A |
| TC-05 | Обратное направление | Поиск Vienna → Prague | T101 нет в результатах | FR-06, сценарий F |
| TC-06 | Одинаковые станции | Поиск Prague → Prague | 400 SAME_STATIONS | FR-09 |
| TC-07 | Нет поездов | Поиск на дату без рейсов | 200, пустой список | FR-08 |
| TC-08 | Карта мест по участку | Купить 12A Prague→Brno, открыть места Brno→Vienna | 12A свободно | FR-11 |
| TC-09 | Повторное использование места | Купить 12A [0,1), затем 12A [1,2) | Оба 201 | FR-18, сценарий B |
| TC-10 | Пересечение | Купить 12A [0,1), затем 12A [0,2) | 409 SEAT_UNAVAILABLE | FR-17, сценарий C |
| TC-11 | Одновременная бронь | 20 параллельных запросов на 12A [0,1) | 1 × 201, 19 × 409 | FR-18, сценарий E |
| TC-12 | Бронь без входа | POST tickets без cookie | 401 | FR-04 |
| TC-13 | Содержимое билета | Забронировать, открыть билет | Номер, пассажир, поезд, дата, станции, время, место, цена | FR-15, FR-16 |
| TC-14 | Отмена | Отменить билет до отправления | 200, CANCELLED | FR-21 |
| TC-15 | Место после отмены | Отменить 12A [0,1), купить 12A [0,2) | 201 | FR-23, сценарий D |
| TC-16 | Отмена после отправления | Отменить билет на ушедший поезд | 409 ALREADY_DEPARTED | FR-21 |
| TC-17 | Отменённый в списке | Отменить, открыть «Мои билеты → Отменённые» | Билет есть | FR-22 |
| TC-18 | Чужой билет | Пользователь B открывает билет A | 404 | FR-24 |
| TC-19 | Чужая отмена | Пользователь B отменяет билет A | 404, билет A не изменился | FR-24 |
| TC-20 | Пассажир в админку | GET /api/admin/stations от пассажира | 403 | Раздел 4 |
| TC-21 | Админ создаёт маршрут и рейсы | Станции → поезд → места → маршрут → цены → рейсы | Рейс находится в поиске | FR-25–29 |
| TC-22 | Выключить место с билетами | PATCH seat isActive=false | 409 HAS_CONFIRMED_TICKETS | FR-31 |
| TC-23 | Отмена рейса админом | POST trips/:id/cancel confirm=true | Все билеты CANCELLED, пассажир видит причину | FR-31 |
| TC-24 | Цена изменилась | Админ меняет цену, пассажир подтверждает со старой | 409 PRICE_CHANGED | FR-13 |
| TC-25 | Админ видит все брони | GET /api/admin/tickets | Билеты всех пассажиров | FR-30 |

### 19.4 E2E-сценарии (Playwright)

1. **Полный путь пассажира:** регистрация → поиск Prague → Brno → выбор места → подтверждение → билет → «Мои билеты» → отмена.
2. **Конфликт мест:** два браузера выбирают одно место, оба нажимают «Подтвердить» → у одного билет, у другого сообщение «Место занято».
3. **Админ:** вход → создать станции, поезд, места, маршрут, цены, рейсы → проверить, что рейс находится в поиске.

### 19.5 Тестовая база

- Для тестов — отдельная база `traintix_test`.
- Перед каждым набором тестов: миграции + очистка таблиц + тестовые данные (T101, Prague → Brno → Vienna).
- Цель покрытия кода: **≥ 80 %** для `services/`.

---

## 20. Нефункциональные требования

### 20.1 Производительность

| Показатель | Цель |
| --- | --- |
| Поиск рейсов | < 1 с при 10 000 рейсов и 100 000 билетов |
| Карта мест | < 500 мс для поезда до 1 000 мест |
| Бронирование | < 1 с |
| Загрузка главной страницы | < 2 с на обычном интернете |
| Одновременные пользователи | 100 без ухудшения скорости |

Как достигается: индексы (8.6), один SQL-запрос вместо многих, пул соединений с БД, сжатие ответов (`compression`), сборка React с минификацией.

### 20.2 Надёжность

| Требование | Как обеспечено |
| --- | --- |
| Никогда двойная продажа | EXCLUDE-ограничение в БД (раздел 14) |
| Нет «полусохранённых» данных | Транзакции |
| Данные не теряются | PostgreSQL + ежедневные бэкапы |
| Ошибка одного запроса не роняет сервер | Единый `errorHandler`, процесс перезапускается хостингом |
| Проверка работоспособности | `GET /api/health` → `{ "status": "ok", "db": "ok" }` |

### 20.3 Масштабируемость

- Сервер **не хранит состояние в памяти** (токен в cookie, данные в БД). Поэтому при росте нагрузки можно запустить **несколько копий** сервера за балансировщиком.
- Узкое место — база данных. Для роста: индексы, при необходимости — реплика только для чтения (для поиска).
- Модули чётко разделены — при необходимости любой можно вынести в отдельный сервис.

### 20.4 Безопасность

См. [раздел 12](#12-аутентификация-и-безопасность): хэширование паролей, httpOnly cookie, проверка прав, защита от SQL-инъекций, XSS, CSRF, подбора пароля.

### 20.5 Удобство использования

- Сайт понятен без инструкции: путь до билета — 4 шага.
- Все ошибки — понятным языком (раздел 13).
- Работает на телефоне.

### 20.6 Совместимость

- Браузеры: последние версии Chrome, Firefox, Safari, Edge.
- Экраны: от 360 px.

### 20.7 Поддерживаемость

- TypeScript, ESLint, Prettier.
- Единая структура модулей.
- README с инструкцией запуска.
- Тесты в CI на каждый push.

---

## 21. Ограничения и риски

### 21.1 Ограничения

| Ограничение | Причина |
| --- | --- |
| Одна бронь = один пассажир, одно место, один поезд | Требования версии 1.0 |
| Нет оплаты и возврата денег | Требования версии 1.0 |
| Нет пересадок | Требования версии 1.0 |
| Поезд не может дважды проезжать одну станцию в маршруте | `UNIQUE (route_id, station_id)` — упрощает поиск |
| Один маршрут — максимум один рейс в день | `UNIQUE (route_id, service_date)`. Для двух рейсов в день — создать два маршрута |
| Места и поезда не удаляются, только выключаются | Чтобы не сломать старые билеты |
| Нет «временного удержания» места при выборе | Место бронируется только при подтверждении; при конфликте — понятное сообщение |
| `EXCLUDE` требует расширения `btree_gist` | Есть во всех стандартных PostgreSQL |

### 21.2 Риски

| Риск | Вероятность | Влияние | Что делаем |
| --- | :---: | :---: | --- |
| Двойная продажа места из-за ошибки в коде | Низкая | Высокое | EXCLUDE в БД + тест на 20 одновременных броней |
| Путаница с часовыми поясами (неправильная дата в поиске) | Средняя | Среднее | Всё хранится в UTC, у станции есть свой часовой пояс, тесты на рейсы около полуночи |
| Prisma не поддерживает EXCLUDE | Высокая | Среднее | Дописать SQL в миграцию вручную (8.7) |
| Админ изменил расписание после продаж | Средняя | Высокое | Защита из 10.8 + пометка «Расписание изменено» |
| Админ забыл задать цены | Средняя | Низкое | Рейсы без цены не создаются, админка показывает пустые пары |
| Утечка JWT_SECRET | Низкая | Высокое | Только в `.env`, никогда в Git; смена секрета = выход всех пользователей |
| Медленный поиск при росте данных | Низкая | Среднее | Индексы, проверка через `EXPLAIN ANALYZE` |
| Не успеть сделать всё | Средняя | Высокое | Сначала обязательные функции (план работ в 22.5), дополнительные — в конце |
| Пассажир долго выбирает, а место уже заняли | Высокая | Низкое | Карта мест обновляется; при конфликте — сообщение и обновление |

---

## 22. Приложения

### 22.1 Словарь терминов

| Термин | Объяснение |
| --- | --- |
| **API** | Набор адресов на сервере, через которые сайт получает и отправляет данные |
| **Endpoint** | Один адрес API, например `POST /api/tickets` |
| **SPA** | Сайт из одной страницы: переходы между экранами без перезагрузки |
| **Монолит** | Всё серверное приложение — одна программа |
| **Middleware** | Функция, которая выполняется до основного обработчика (проверка входа, ролей…) |
| **Controller** | Код, принимающий HTTP-запрос |
| **Service** | Код с бизнес-правилами |
| **Repository** | Код, работающий с базой данных |
| **JWT** | Подписанный токен, подтверждающий, кто пользователь |
| **Cookie httpOnly** | Cookie, которую не может прочитать JavaScript на странице |
| **bcrypt** | Алгоритм надёжного хэширования паролей |
| **Хэш** | Необратимое «зашифрованное» значение пароля |
| **Транзакция** | Группа операций с БД, которая выполняется целиком или не выполняется вообще |
| **COMMIT / ROLLBACK** | Сохранить / отменить транзакцию |
| **PK / FK** | Первичный ключ (уникальный ID строки) / внешний ключ (ссылка на другую таблицу) |
| **UNIQUE** | Значение не может повторяться |
| **EXCLUDE** | Правило PostgreSQL: запрещает строки, которые «конфликтуют» между собой |
| **Гонка (race condition)** | Ошибка, когда два одновременных действия мешают друг другу |
| **Миграция** | Файл с изменением структуры БД |
| **Seed** | Скрипт, заполняющий БД начальными данными |
| **Станция** | Пункт остановки поезда |
| **Маршрут** | Шаблон: какие станции и через сколько минут проходит поезд |
| **Рейс** | Маршрут в конкретную дату с точным временем |
| **Остановка** | Станция в маршруте с порядковым номером (0, 1, 2…) |
| **Участок** | Отрезок пути между двумя соседними остановками |
| **Полуоткрытый интервал [a, b)** | От `a` включительно до `b` не включая |
| **Билет** | Право ехать на месте X рейса Y от остановки A до остановки B |
| **CONFIRMED / CANCELLED** | Подтверждён / Отменён |

### 22.2 Список схем в документе

| Схема | Раздел |
| --- | --- |
| Система в одной картинке | 2.4 |
| Общая структура приложения | 5.2 |
| Структура папок | 7.3 |
| ER-диаграмма базы данных | 8.2 |
| Схема связей таблиц (текстом) | 8.3 |
| Создание рейсов | 10.1 |
| Поиск рейсов | 10.2 |
| Бронирование | 10.4 |
| Отмена билета | 10.5 |
| Статусы билета | 10.7 |
| Изменения администратора | 10.8 |
| Участки и пересечения | 11.1–11.2 |
| Карта мест | 11.4 |
| Регистрация | 12.1 |
| Гонка и её решение | 14.1–14.2 |
| Взаимодействие компонентов | 16.2 |
| Вход пользователя | 16.3 |
| Путь пассажира | 17.2 |
| Макеты экранов | 17.3 |
| Дерево компонентов | 17.4 |
| Продакшен | 18.2 |
| Пирамида тестов | 19.1 |

### 22.3 Начальные данные (seed)

| Что | Значение |
| --- | --- |
| Админ | `admin@traintix.local` / пароль из `.env` (`SEED_ADMIN_PASSWORD`) |
| Пассажир для тестов | `anna@example.com` / `secret123` |
| Станции | Prague (PRG), Brno (BRN), Vienna (VIE), Bratislava (BTS), Ostrava (OST) |
| Поезда | T101 (3 вагона × 40 мест), T205 (2 вагона × 40 мест) |
| Маршруты | T101: Prague → Brno → Vienna, 07:00; T205: Ostrava → Brno → Bratislava, 13:15 |
| Цены | Для всех пар остановок |
| Рейсы | На 14 дней вперёд от сегодняшней даты |

### 22.4 Соответствие критериям приёмки PRD

| ☐ Критерий | Как выполнено | Тест |
| --- | --- | --- |
| Посетитель может зарегистрироваться, войти и искать | Разделы 9.3, 10.2, 17 | TC-01, TC-04 |
| Можно найти поезд между промежуточными станциями | Алгоритм 10.2 | TC-04 |
| Доступность показывается для участка, а не всего поезда | Алгоритм 11.4 | TC-08 |
| Два непересекающихся билета на одно место — можно | Интервалы [from, to) | TC-09 |
| Два пересекающихся билета на одно место — нельзя | EXCLUDE (раздел 14) | TC-10, TC-11 |
| Пассажир бронирует и видит билет | 10.4, 17 | TC-13 |
| Отмена освобождает место | 10.5 | TC-14, TC-15 |
| Нельзя смотреть чужие билеты | 12.4 | TC-18, TC-19 |
| Админ управляет данными для поездов | 9.6, 10.1, 17 | TC-21 |
| Понятные сообщения при ошибках | Раздел 13 | TC-06, TC-10, TC-16 |

### 22.5 План работ

```mermaid
flowchart LR
    S1["1. Каркас проекта<br/>Vite, Express, Docker, CI"] --> S2["2. База данных<br/>миграции, EXCLUDE, seed"]
    S2 --> S3["3. Вход и регистрация"]
    S3 --> S4["4. Админка<br/>станции, поезда, маршруты, цены, рейсы"]
    S4 --> S5["5. Поиск и карта мест"]
    S5 --> S6["6. Бронирование<br/>+ тест одновременности"]
    S6 --> S7["7. Мои билеты и отмена"]
    S7 --> S8["8. Защита изменений админа,<br/>логи, аудит"]
    S8 --> S9["9. E2E-тесты, деплой, README"]
    S9 --> S10["10. Дополнительно:<br/>email, PDF, карта вагона"]
```

| Этап | Результат |
| --- | --- |
| 1. Каркас | Проект запускается, в CI проходит пустой тест |
| 2. База данных | Все таблицы созданы, есть тестовые данные |
| 3. Вход | Можно зарегистрироваться, войти, выйти |
| 4. Админка | Админ может создать всё для рейса |
| 5. Поиск и места | Можно найти поезд и увидеть свободные места |
| 6. Бронирование | Можно купить билет, двойная продажа невозможна |
| 7. Билеты | Можно смотреть и отменять билеты |
| 8. Защита и логи | Админ не может сломать проданные билеты, есть журнал |
| 9. Финал | Все тесты зелёные, сайт развёрнут |
| 10. Дополнительно | По желанию |
