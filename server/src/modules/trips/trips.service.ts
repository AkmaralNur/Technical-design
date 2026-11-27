import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../utils/AppError';
import { dateOnly, localTime, money, paging } from '../../utils/format';
import * as audit from '../audit/audit.service';
import { queueEmail } from '../notifications/notifications.service';
import { missingFares } from '../routes/routes.service';
import { selectTickets } from '../tickets/tickets.repository';
import * as repo from './trips.repository';
import type { adminTripsQuerySchema, cancelTripSchema, createTripsSchema, SearchQuery, updateScheduleSchema } from './trips.schema';

// ---------------------------------------------------------------- поиск

/** Поиск рейсов (раздел 10.2) */
export async function search(q: SearchQuery) {
  if (q.from === q.to) throw new AppError(400, 'SAME_STATIONS');
  const stations = await db.station.count({ where: { id: { in: [BigInt(q.from), BigInt(q.to)] } } });
  if (stations !== 2) throw new AppError(404, 'STATION_NOT_FOUND');

  const rows = await repo.searchTrips(q);

  // собираем строки одного рейса в одну карточку
  const byTrip = new Map<number, ReturnType<typeof newCard>>();
  function newCard(r: repo.SearchRow) {
    return {
      tripId: Number(r.trip_id),
      trainNumber: r.train_number,
      trainName: r.train_name,
      scheduleChanged: r.schedule_changed,
      from: { stationId: Number(r.from_station_id), name: r.from_name, stopOrder: r.from_order, departureAt: r.departure_at, timezone: r.from_tz },
      to: { stationId: Number(r.to_station_id), name: r.to_name, stopOrder: r.to_order, arrivalAt: r.arrival_at, timezone: r.to_tz },
      durationMinutes: r.duration_min,
      minPrice: null as null | { amount: string; currency: string },
      classes: [] as { seatClass: string; price: { amount: string; currency: string }; freeSeats: number }[],
      freeSeats: 0,
      hasSeats: false,
    };
  }
  for (const r of rows) {
    if (Number(r.total_seats) === 0) continue; // в поезде нет вагонов этого класса
    const id = Number(r.trip_id);
    const card = byTrip.get(id) ?? newCard(r);
    byTrip.set(id, card);
    const price = money(r.price, r.currency);
    card.classes.push({ seatClass: r.seat_class, price, freeSeats: Number(r.free_seats) });
    card.freeSeats += Number(r.free_seats);
    if (!card.minPrice || Number(price.amount) < Number(card.minPrice.amount)) card.minPrice = price;
  }
  let items = [...byTrip.values()].map((c) => ({ ...c, hasSeats: c.freeSeats > 0 }));
  if (q.onlyAvailable) items = items.filter((i) => i.hasSeats);

  const sort = q.sort ?? 'departure';
  items.sort((a, b) => {
    if (sort === 'price') return Number(a.minPrice?.amount ?? 0) - Number(b.minPrice?.amount ?? 0);
    if (sort === 'duration') return a.durationMinutes - b.durationMinutes;
    return a.from.departureAt.getTime() - b.from.departureAt.getTime();
  });
  return { items };
}

// ---------------------------------------------------------------- рейс и места

function stopDto(s: NonNullable<Awaited<ReturnType<typeof repo.findTripWithStops>>>['stops'][number]) {
  return {
    stopOrder: s.stopOrder,
    stationId: Number(s.stationId),
    name: s.station.name,
    code: s.station.code,
    timezone: s.station.timezone,
    arrivalAt: s.arrivalAt,
    departureAt: s.departureAt,
  };
}

async function loadTrip(id: number) {
  const trip = await repo.findTripWithStops(id);
  if (!trip) throw new AppError(404, 'NOT_FOUND', 'Рейс не найден');
  return trip;
}

function checkJourney(trip: Awaited<ReturnType<typeof loadTrip>>, from: number, to: number) {
  const f = trip.stops.find((s) => s.stopOrder === from);
  const t = trip.stops.find((s) => s.stopOrder === to);
  if (!f || !t || from >= to) throw new AppError(400, 'INVALID_JOURNEY');
  return { f, t };
}

/** Цены участка для классов, которые есть в поезде */
async function journeyPrices(routeId: bigint, trainId: bigint, from: number, to: number) {
  const [fares, carriages] = await Promise.all([
    db.fare.findMany({ where: { routeId, fromStopOrder: from, toStopOrder: to } }),
    db.carriage.findMany({ where: { trainId, isActive: true }, select: { seatClass: true }, distinct: ['seatClass'] }),
  ]);
  const classes = new Set(carriages.map((c) => c.seatClass));
  return fares
    .filter((f) => classes.has(f.seatClass))
    .sort((a, b) => a.seatClass.localeCompare(b.seatClass))
    .map((f) => ({ seatClass: f.seatClass, ...money(f.price, f.currency) }));
}

/** Рейс и все его остановки (раздел 9.4, п. 7) */
export async function getTrip(id: number, from?: number, to?: number) {
  const trip = await loadTrip(id);
  let selected = null;
  if (from !== undefined || to !== undefined) {
    if (from === undefined || to === undefined) throw new AppError(400, 'INVALID_JOURNEY');
    const { f, t } = checkJourney(trip, from, to);
    selected = {
      from,
      to,
      departed: !f.departureAt || f.departureAt <= new Date(),
      durationMinutes: f.departureAt && t.arrivalAt ? Math.round((t.arrivalAt.getTime() - f.departureAt.getTime()) / 60000) : null,
      prices: await journeyPrices(trip.routeId, trip.trainId, from, to),
    };
  }
  return {
    tripId: Number(trip.id),
    trainNumber: trip.train.number,
    trainName: trip.train.name,
    routeName: trip.route.name,
    date: dateOnly(trip.serviceDate),
    status: trip.status,
    scheduleChanged: trip.scheduleChanged,
    cancelReason: trip.cancelReason,
    stops: trip.stops.map(stopDto),
    selected,
  };
}

/** Карта мест на участке (раздел 11.4) */
export async function getSeatMap(id: number, from: number, to: number) {
  const trip = await loadTrip(id);
  checkJourney(trip, from, to);
  const [rows, prices] = await Promise.all([repo.seatMap(id, from, to), journeyPrices(trip.routeId, trip.trainId, from, to)]);
  const carriages = new Map<number, {
    carriageNo: number;
    seatClass: string;
    price: { amount: string; currency: string } | null;
    rowsCount: number;
    layout: string;
    freeSeats: number;
    seats: { seatId: number; label: string; row: number; letter: string; available: boolean }[];
  }>();
  for (const r of rows) {
    let c = carriages.get(r.carriage_no);
    if (!c) {
      const p = prices.find((x) => x.seatClass === r.seat_class);
      c = {
        carriageNo: r.carriage_no,
        seatClass: r.seat_class,
        price: p ? { amount: p.amount, currency: p.currency } : null,
        rowsCount: r.rows_count,
        layout: r.layout,
        freeSeats: 0,
        seats: [],
      };
      carriages.set(r.carriage_no, c);
    }
    const available = r.available && trip.status === 'SCHEDULED' && c.price !== null;
    if (available) c.freeSeats++;
    c.seats.push({ seatId: Number(r.seat_id), label: r.seat_label, row: r.row_no, letter: r.seat_letter, available });
  }
  return { tripId: id, from, to, tripStatus: trip.status, carriages: [...carriages.values()] };
}

// ---------------------------------------------------------------- админ: рейсы

/** Создание рейсов на даты (раздел 10.1). Точное время считается в часовом поясе маршрута */
export async function createTrips(adminId: number, dto: z.infer<typeof createTripsSchema>) {
  const route = await db.route.findUnique({ where: { id: dto.routeId } });
  if (!route) throw new AppError(404, 'NOT_FOUND', 'Маршрут не найден');
  if (!route.isActive) throw new AppError(409, 'ROUTE_INACTIVE');
  const { missing, classes } = await missingFares(route.id, route.trainId);
  if (classes.length === 0) throw new AppError(409, 'VALIDATION_ERROR', 'В поезде нет активных вагонов');
  if (missing.length) throw new AppError(409, 'FARES_MISSING', undefined, { missing });

  const start = new Date(`${dto.dateFrom}T00:00:00Z`);
  const end = new Date(`${dto.dateTo}T00:00:00Z`);
  if ((end.getTime() - start.getTime()) / 86_400_000 > 366) throw new AppError(400, 'VALIDATION_ERROR', 'Максимум 1 год за раз');

  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (dto.weekdays.includes(iso)) dates.push(dateOnly(d));
  }

  let created = 0;
  await db.$transaction(
    async (tx) => {
      for (const date of dates) {
        const inserted = await tx.$queryRaw<{ id: bigint }[]>`
          INSERT INTO trips (route_id, train_id, service_date)
          VALUES (${route.id}, ${route.trainId}, ${date}::date)
          ON CONFLICT (route_id, service_date) DO NOTHING
          RETURNING id`;
        if (!inserted.length) continue; // рейс на эту дату уже есть — пропускаем
        const tripId = inserted[0].id;
        // start = D + departure_time в часовом поясе маршрута; к нему прибавляем смещения остановок
        await tx.$executeRaw`
          INSERT INTO trip_stops (trip_id, stop_order, station_id, arrival_at, departure_at)
          SELECT ${tripId}, rs.stop_order, rs.station_id,
                 ((${date}::date + r.departure_time) AT TIME ZONE r.timezone) + rs.arrival_offset_min   * interval '1 minute',
                 ((${date}::date + r.departure_time) AT TIME ZONE r.timezone) + rs.departure_offset_min * interval '1 minute'
            FROM route_stops rs JOIN routes r ON r.id = rs.route_id
           WHERE rs.route_id = ${route.id}`;
        created++;
      }
      await audit.log(tx, adminId, 'TRIPS_CREATED', 'route', route.id, { dateFrom: dto.dateFrom, dateTo: dto.dateTo, created });
    },
    { timeout: 60_000 },
  );
  return { created, skipped: dates.length - created };
}

/** Список рейсов для админки */
export async function listAdmin(q: z.infer<typeof adminTripsQuerySchema>) {
  const where: Prisma.TripWhereInput = {
    routeId: q.routeId,
    status: q.status,
    serviceDate: {
      gte: q.dateFrom ? new Date(`${q.dateFrom}T00:00:00Z`) : undefined,
      lte: q.dateTo ? new Date(`${q.dateTo}T00:00:00Z`) : undefined,
    },
  };
  const { page, limit, offset } = paging(q.page, q.limit);
  const [trips, total] = await Promise.all([
    db.trip.findMany({
      where,
      orderBy: [{ serviceDate: 'asc' }, { id: 'asc' }],
      skip: offset,
      take: limit,
      include: {
        train: true,
        route: true,
        stops: { orderBy: { stopOrder: 'asc' }, include: { station: true } },
        _count: { select: { tickets: { where: { status: 'CONFIRMED' } } } },
      },
    }),
    db.trip.count({ where }),
  ]);
  return {
    items: trips.map((t) => ({
      tripId: Number(t.id),
      routeId: Number(t.routeId),
      routeName: t.route.name,
      trainNumber: t.train.number,
      date: dateOnly(t.serviceDate),
      status: t.status,
      scheduleChanged: t.scheduleChanged,
      cancelReason: t.cancelReason,
      soldTickets: t._count.tickets,
      stops: t.stops.map(stopDto),
    })),
    page,
    limit,
    total,
  };
}

/** Изменить время рейса (раздел 10.8). С проданными билетами нужно confirm=true */
export async function updateSchedule(adminId: number, tripId: number, dto: z.infer<typeof updateScheduleSchema>) {
  const trip = await loadTrip(tripId);
  if (trip.status === 'CANCELLED') throw new AppError(409, 'TRIP_CANCELLED');

  const next = trip.stops.map((s) => ({ stopOrder: s.stopOrder, name: s.station.name, arrivalAt: s.arrivalAt, departureAt: s.departureAt }));
  const last = next.length - 1;
  for (const change of dto.stops) {
    const s = next.find((x) => x.stopOrder === change.stopOrder);
    if (!s) throw new AppError(400, 'VALIDATION_ERROR', `Нет остановки №${change.stopOrder}`);
    if (change.arrivalAt !== undefined && s.stopOrder > 0) s.arrivalAt = change.arrivalAt ? new Date(change.arrivalAt) : null;
    if (change.departureAt !== undefined && s.stopOrder < last) s.departureAt = change.departureAt ? new Date(change.departureAt) : null;
  }
  // проверка порядка времени
  let prev = 0;
  for (const s of next) {
    if (s.stopOrder > 0 && !s.arrivalAt) throw new AppError(400, 'VALIDATION_ERROR', `Нет времени прибытия в «${s.name}»`);
    if (s.stopOrder < last && !s.departureAt) throw new AppError(400, 'VALIDATION_ERROR', `Нет времени отправления из «${s.name}»`);
    if (s.arrivalAt) {
      if (s.arrivalAt.getTime() <= prev) throw new AppError(400, 'VALIDATION_ERROR', `Прибытие в «${s.name}» должно быть позже предыдущей остановки`);
      prev = s.arrivalAt.getTime();
    }
    if (s.departureAt) {
      if (s.departureAt.getTime() < prev) throw new AppError(400, 'VALIDATION_ERROR', `Отправление из «${s.name}» раньше прибытия`);
      prev = s.departureAt.getTime();
    }
  }

  const ticketsCount = await db.ticket.count({ where: { tripId, status: 'CONFIRMED' } });
  if (ticketsCount > 0 && !dto.confirm) {
    throw new AppError(409, 'HAS_CONFIRMED_TICKETS', `На рейс продано билетов: ${ticketsCount}. Пассажиры получат письмо об изменении. Подтвердите изменение.`, { ticketsCount });
  }

  await db.$transaction(
    async (tx) => {
      const before = await selectTickets(tx, [Prisma.sql`k.trip_id = ${tripId}`, Prisma.sql`k.status = 'CONFIRMED'`]);
      for (const s of next) {
        await tx.tripStop.update({
          where: { tripId_stopOrder: { tripId, stopOrder: s.stopOrder } },
          data: { arrivalAt: s.arrivalAt, departureAt: s.departureAt },
        });
      }
      if (ticketsCount > 0) await tx.trip.update({ where: { id: tripId }, data: { scheduleChanged: true } });
      await audit.log(tx, adminId, 'TRIP_SCHEDULE_CHANGED', 'trip', tripId, {
        before: trip.stops.map((s) => ({ stopOrder: s.stopOrder, arrivalAt: s.arrivalAt, departureAt: s.departureAt })),
        after: next.map((s) => ({ stopOrder: s.stopOrder, arrivalAt: s.arrivalAt, departureAt: s.departureAt })),
        ticketsCount,
      });
      const after = await selectTickets(tx, [Prisma.sql`k.trip_id = ${tripId}`, Prisma.sql`k.status = 'CONFIRMED'`]);
      for (const row of after) {
        const old = before.find((b) => b.id === row.id)!;
        const changed = old.departure_at.getTime() !== row.departure_at.getTime() || old.arrival_at.getTime() !== row.arrival_at.getTime();
        if (!changed) continue;
        await queueEmail(tx, 'SCHEDULE_CHANGED', row, {
          oldDeparture: localTime(old.departure_at, old.from_tz),
          oldArrival: localTime(old.arrival_at, old.to_tz),
        });
      }
    },
    { timeout: 60_000 },
  );
  return getTrip(tripId);
}

/** Отменить рейс: все билеты → CANCELLED (cancelled_by = ADMIN), письма пассажирам */
export async function cancelTrip(adminId: number, tripId: number, dto: z.infer<typeof cancelTripSchema>) {
  const trip = await loadTrip(tripId);
  if (trip.status === 'CANCELLED') throw new AppError(409, 'TRIP_CANCELLED', 'Рейс уже отменён');
  const ticketsCount = await db.ticket.count({ where: { tripId, status: 'CONFIRMED' } });
  if (ticketsCount > 0 && !dto.confirm) {
    throw new AppError(409, 'HAS_CONFIRMED_TICKETS', `На рейс продано билетов: ${ticketsCount}. Все они будут отменены. Подтвердите отмену.`, { ticketsCount });
  }
  const cancelled = await db.$transaction(
    async (tx) => {
      await tx.trip.update({ where: { id: tripId }, data: { status: 'CANCELLED', cancelReason: dto.reason } });
      const ids = await tx.$queryRaw<{ id: bigint }[]>`
        UPDATE tickets SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = 'ADMIN'
         WHERE trip_id = ${tripId} AND status = 'CONFIRMED'
        RETURNING id`;
      if (ids.length) {
        const rows = await selectTickets(tx, [Prisma.sql`k.id IN (${Prisma.join(ids.map((i) => i.id))})`]);
        for (const row of rows) await queueEmail(tx, 'TRIP_CANCELLED', row, { reason: dto.reason });
      }
      await audit.log(tx, adminId, 'TRIP_CANCELLED', 'trip', tripId, { reason: dto.reason, ticketsCancelled: ids.length });
      return ids.length;
    },
    { timeout: 60_000 },
  );
  return { tripId, status: 'CANCELLED', ticketsCancelled: cancelled };
}
