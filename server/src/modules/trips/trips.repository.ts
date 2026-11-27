import { Prisma } from '@prisma/client';
import { db } from '../../db/client';

export interface SearchRow {
  trip_id: bigint;
  train_number: string;
  train_name: string | null;
  schedule_changed: boolean;
  from_order: number;
  to_order: number;
  from_station_id: bigint;
  to_station_id: bigint;
  from_name: string;
  to_name: string;
  from_tz: string;
  to_tz: string;
  departure_at: Date;
  arrival_at: Date;
  duration_min: number;
  seat_class: 'ECONOMY' | 'BUSINESS';
  price: Prisma.Decimal;
  currency: string;
  free_seats: bigint;
  total_seats: bigint;
}

/** Поиск рейсов (раздел 10.2): одна строка на «рейс + класс» */
export function searchTrips(p: {
  from: number;
  to: number;
  date: string;
  seatClass?: string;
  maxPrice?: number;
  departAfter?: string;
  departBefore?: string;
}) {
  return db.$queryRaw<SearchRow[]>`
    SELECT t.id                    AS trip_id,
           tr.number               AS train_number,
           tr.name                 AS train_name,
           t.schedule_changed,
           fs.stop_order           AS from_order,
           ts.stop_order           AS to_order,
           fs.station_id           AS from_station_id,
           ts.station_id           AS to_station_id,
           sf.name                 AS from_name,
           st.name                 AS to_name,
           sf.timezone             AS from_tz,
           st.timezone             AS to_tz,
           fs.departure_at,
           ts.arrival_at,
           (EXTRACT(EPOCH FROM (ts.arrival_at - fs.departure_at)) / 60)::int AS duration_min,
           f.seat_class::text      AS seat_class,
           f.price, f.currency,
           (SELECT COUNT(*) FROM seats s
              JOIN carriages c ON c.train_id = s.train_id AND c.carriage_no = s.carriage_no
             WHERE s.train_id = t.train_id AND s.is_active AND c.is_active
               AND c.seat_class = f.seat_class
               AND NOT EXISTS (
                 SELECT 1 FROM tickets k
                  WHERE k.trip_id = t.id AND k.seat_id = s.id
                    AND k.status = 'CONFIRMED'
                    AND k.from_stop_order < ts.stop_order
                    AND fs.stop_order < k.to_stop_order)
           )                       AS free_seats,
           (SELECT COUNT(*) FROM seats s
              JOIN carriages c ON c.train_id = s.train_id AND c.carriage_no = s.carriage_no
             WHERE s.train_id = t.train_id AND s.is_active AND c.is_active
               AND c.seat_class = f.seat_class) AS total_seats
      FROM trips t
      JOIN trains tr     ON tr.id = t.train_id
      JOIN trip_stops fs ON fs.trip_id = t.id AND fs.station_id = ${p.from}
      JOIN trip_stops ts ON ts.trip_id = t.id AND ts.station_id = ${p.to}
      JOIN stations sf   ON sf.id = fs.station_id
      JOIN stations st   ON st.id = ts.station_id
      JOIN fares f       ON f.route_id = t.route_id
                        AND f.from_stop_order = fs.stop_order
                        AND f.to_stop_order   = ts.stop_order
     WHERE t.status = 'SCHEDULED'
       AND tr.is_active
       AND fs.stop_order < ts.stop_order
       AND (fs.departure_at AT TIME ZONE sf.timezone)::date = ${p.date}::date
       AND fs.departure_at > now()
       AND (${p.seatClass ?? null}::seat_class IS NULL OR f.seat_class = ${p.seatClass ?? null}::seat_class)
       AND (${p.maxPrice ?? null}::numeric IS NULL OR f.price <= ${p.maxPrice ?? null}::numeric)
       AND (${p.departAfter ?? null}::time IS NULL OR (fs.departure_at AT TIME ZONE sf.timezone)::time >= ${p.departAfter ?? null}::time)
       AND (${p.departBefore ?? null}::time IS NULL OR (fs.departure_at AT TIME ZONE sf.timezone)::time <= ${p.departBefore ?? null}::time)
     ORDER BY fs.departure_at, f.seat_class`;
}

export interface SeatMapRow {
  seat_id: bigint;
  carriage_no: number;
  row_no: number;
  seat_letter: string;
  seat_label: string;
  seat_class: 'ECONOMY' | 'BUSINESS';
  rows_count: number;
  layout: string;
  available: boolean;
}

/** Карта мест для участка [from, to) — одним запросом (раздел 11.4) */
export function seatMap(tripId: number, from: number, to: number) {
  return db.$queryRaw<SeatMapRow[]>`
    SELECT s.id AS seat_id, s.carriage_no, s.row_no, s.seat_letter, s.seat_label,
           c.seat_class::text AS seat_class, c.rows_count, c.layout,
           NOT EXISTS (
             SELECT 1 FROM tickets k
              WHERE k.trip_id = ${tripId}
                AND k.seat_id = s.id
                AND k.status = 'CONFIRMED'
                AND k.from_stop_order < ${to}
                AND ${from} < k.to_stop_order
           ) AS available
      FROM seats s
      JOIN trips t     ON t.id = ${tripId} AND t.train_id = s.train_id
      JOIN carriages c ON c.train_id = s.train_id AND c.carriage_no = s.carriage_no
     WHERE s.is_active AND c.is_active
     ORDER BY s.carriage_no, s.row_no, s.seat_letter`;
}

/** Рейс со всеми остановками */
export function findTripWithStops(id: number) {
  return db.trip.findUnique({
    where: { id },
    include: {
      train: true,
      route: true,
      stops: { orderBy: { stopOrder: 'asc' }, include: { station: true } },
    },
  });
}
