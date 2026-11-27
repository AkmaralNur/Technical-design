import { Prisma } from '@prisma/client';
import type { Tx } from '../../db/client';
import { db } from '../../db/client';
import { localIsoDate, money } from '../../utils/format';

/** Строка билета вместе с актуальным временем из trip_stops и данными рейса */
export interface TicketRow {
  id: bigint;
  ticket_number: string;
  user_id: bigint;
  trip_id: bigint;
  seat_id: bigint;
  from_stop_order: number;
  to_stop_order: number;
  price: Prisma.Decimal;
  currency: string;
  status: 'CONFIRMED' | 'CANCELLED';
  passenger_name: string;
  train_number: string;
  carriage_no: number;
  seat_label: string;
  seat_class: 'ECONOMY' | 'BUSINESS';
  from_station_name: string;
  to_station_name: string;
  created_at: Date;
  cancelled_at: Date | null;
  cancelled_by: 'PASSENGER' | 'ADMIN' | null;
  departure_at: Date;
  arrival_at: Date;
  from_tz: string;
  to_tz: string;
  service_date: Date;
  trip_status: 'SCHEDULED' | 'CANCELLED';
  cancel_reason: string | null;
  schedule_changed: boolean;
  user_email: string;
}

export const TICKET_SELECT = Prisma.sql`
  SELECT k.id, k.ticket_number, k.user_id, k.trip_id, k.seat_id, k.from_stop_order, k.to_stop_order,
         k.price, k.currency, k.status::text AS status, k.passenger_name, k.train_number, k.carriage_no,
         k.seat_label, k.seat_class::text AS seat_class, k.from_station_name, k.to_station_name,
         k.created_at, k.cancelled_at, k.cancelled_by::text AS cancelled_by,
         fs.departure_at, ts.arrival_at, sf.timezone AS from_tz, st.timezone AS to_tz,
         t.service_date, t.status::text AS trip_status, t.cancel_reason, t.schedule_changed,
         u.email AS user_email
    FROM tickets k
    JOIN trips t       ON t.id = k.trip_id
    JOIN trip_stops fs ON fs.trip_id = k.trip_id AND fs.stop_order = k.from_stop_order
    JOIN trip_stops ts ON ts.trip_id = k.trip_id AND ts.stop_order = k.to_stop_order
    JOIN stations sf   ON sf.id = fs.station_id
    JOIN stations st   ON st.id = ts.station_id
    JOIN users u       ON u.id = k.user_id`;

/** Выбрать билеты по условиям (условия — только параметризованные фрагменты Prisma.sql) */
export function selectTickets(
  client: Tx | typeof db,
  where: Prisma.Sql[],
  orderBy: Prisma.Sql = Prisma.sql`k.created_at DESC`,
  limit?: number,
  offset?: number,
) {
  const cond = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
  const lim = limit !== undefined ? Prisma.sql`LIMIT ${limit} OFFSET ${offset ?? 0}` : Prisma.empty;
  return client.$queryRaw<TicketRow[]>`${TICKET_SELECT} ${cond} ORDER BY ${orderBy} ${lim}`;
}

export async function countTickets(client: Tx | typeof db, where: Prisma.Sql[]) {
  const cond = where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty;
  const rows = await client.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
      FROM tickets k
      JOIN trips t       ON t.id = k.trip_id
      JOIN trip_stops fs ON fs.trip_id = k.trip_id AND fs.stop_order = k.from_stop_order
      JOIN trip_stops ts ON ts.trip_id = k.trip_id AND ts.stop_order = k.to_stop_order
      JOIN stations sf   ON sf.id = fs.station_id
      JOIN users u       ON u.id = k.user_id
      ${cond}`;
  return Number(rows[0]?.total ?? 0);
}

export async function findTicketRow(client: Tx | typeof db, id: number, userId?: number) {
  const where = [Prisma.sql`k.id = ${id}`];
  if (userId !== undefined) where.push(Prisma.sql`k.user_id = ${userId}`);
  const rows = await selectTickets(client, where);
  return rows[0] ?? null;
}

/** «Предстоящий» / «Завершённый» не хранятся, а вычисляются по времени (раздел 10.7) */
export function displayStatus(row: Pick<TicketRow, 'status' | 'departure_at'>) {
  if (row.status === 'CANCELLED') return 'CANCELLED' as const;
  return row.departure_at.getTime() > Date.now() ? ('UPCOMING' as const) : ('COMPLETED' as const);
}

/** Билет в формате API (раздел 9.5) */
export function toTicketDto(row: TicketRow, opts: { withEmail?: boolean } = {}) {
  const display = displayStatus(row);
  return {
    id: Number(row.id),
    ticketNumber: row.ticket_number,
    status: row.status,
    displayStatus: display,
    passengerName: row.passenger_name,
    trainNumber: row.train_number,
    tripId: Number(row.trip_id),
    date: localIsoDate(row.departure_at, row.from_tz),
    from: { name: row.from_station_name, stopOrder: row.from_stop_order, departureAt: row.departure_at, timezone: row.from_tz },
    to: { name: row.to_station_name, stopOrder: row.to_stop_order, arrivalAt: row.arrival_at, timezone: row.to_tz },
    seat: { seatId: Number(row.seat_id), carriageNo: row.carriage_no, label: row.seat_label, seatClass: row.seat_class },
    price: money(row.price, row.currency),
    canCancel: display === 'UPCOMING',
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    trip: { status: row.trip_status, cancelReason: row.cancel_reason, scheduleChanged: row.schedule_changed },
    ...(opts.withEmail ? { userEmail: row.user_email } : {}),
  };
}

export type TicketDto = ReturnType<typeof toTicketDto>;
