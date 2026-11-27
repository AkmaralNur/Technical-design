-- TrainTix: начальная миграция (точно по разделу 8.7 технического дизайна).
-- Содержит ограничение EXCLUDE no_double_booking — его нельзя описать в schema.prisma.

-- расширение нужно для EXCLUDE с обычными числами
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role     AS ENUM ('PASSENGER', 'ADMIN');
CREATE TYPE trip_status   AS ENUM ('SCHEDULED', 'CANCELLED');
CREATE TYPE ticket_status AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE seat_class    AS ENUM ('ECONOMY', 'BUSINESS');
CREATE TYPE email_status  AS ENUM ('PENDING', 'SENT', 'FAILED');

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

CREATE TABLE carriages (
  id          BIGSERIAL PRIMARY KEY,
  train_id    BIGINT NOT NULL REFERENCES trains(id),
  carriage_no SMALLINT NOT NULL CHECK (carriage_no > 0),
  seat_class  seat_class NOT NULL DEFAULT 'ECONOMY',
  rows_count  SMALLINT NOT NULL CHECK (rows_count > 0),
  layout      VARCHAR(10) NOT NULL CHECK (layout ~ '^[A-Z_]+$'),  -- 'AB_CD'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (train_id, carriage_no)
);

CREATE TABLE seats (
  id          BIGSERIAL PRIMARY KEY,
  train_id    BIGINT NOT NULL REFERENCES trains(id),
  carriage_no SMALLINT NOT NULL,
  row_no      SMALLINT NOT NULL CHECK (row_no > 0),
  seat_letter CHAR(1)  NOT NULL,
  seat_label  VARCHAR(10) NOT NULL,                                -- '12A'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (train_id, carriage_no, seat_label),
  FOREIGN KEY (train_id, carriage_no) REFERENCES carriages (train_id, carriage_no)
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
  seat_class      seat_class NOT NULL DEFAULT 'ECONOMY',
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'EUR',
  CHECK (from_stop_order < to_stop_order),
  UNIQUE (route_id, from_stop_order, to_stop_order, seat_class)
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
  seat_class        seat_class   NOT NULL,
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

CREATE TABLE email_outbox (
  id              BIGSERIAL PRIMARY KEY,
  type            VARCHAR(30)  NOT NULL,
  to_email        VARCHAR(255) NOT NULL,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  ticket_id       BIGINT REFERENCES tickets(id),
  payload         JSONB NOT NULL,
  status          email_status NOT NULL DEFAULT 'PENDING',
  attempts        SMALLINT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_trip_stops_station ON trip_stops (station_id, trip_id);
CREATE INDEX idx_trips_date         ON trips (service_date, status);
CREATE INDEX idx_tickets_trip_seat  ON tickets (trip_id, seat_id);
CREATE INDEX idx_tickets_user       ON tickets (user_id, created_at DESC);
CREATE INDEX idx_tickets_status     ON tickets (status, created_at DESC);
CREATE INDEX idx_outbox_pending     ON email_outbox (status, next_attempt_at);
