import { Prisma } from '@prisma/client';
import { db } from '../../db/client';
import { AppError, isPgError } from '../../utils/AppError';
import { paging } from '../../utils/format';
import { generateTicketNumber } from '../../utils/ticketNumber';
import * as audit from '../audit/audit.service';
import { queueEmail } from '../notifications/notifications.service';
import type { BookTicketDto, MyTicketsQuery } from './tickets.schema';
import { countTickets, findTicketRow, selectTickets, toTicketDto } from './tickets.repository';
import { buildTicketPdf } from './ticketPdf';

/** Бронирование билета (раздел 10.4). Защита от двойной продажи — EXCLUDE в БД (раздел 14) */
export async function bookTicket(userId: number, dto: BookTicketDto) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await bookOnce(userId, dto);
    } catch (e) {
      if (isPgError(e, '23P01')) throw new AppError(409, 'SEAT_UNAVAILABLE');
      // совпал номер билета (почти невозможно) — повторяем до 3 раз
      if (isPgError(e, '23505') && attempt < 3 && !(e instanceof AppError)) continue;
      throw e;
    }
  }
}

async function bookOnce(userId: number, dto: BookTicketDto) {
  return db.$transaction(async (tx) => {
    // 1. рейс
    const trip = await tx.trip.findUnique({
      where: { id: dto.tripId },
      include: { train: true, stops: { include: { station: true }, orderBy: { stopOrder: 'asc' } } },
    });
    if (!trip) throw new AppError(404, 'NOT_FOUND', 'Рейс не найден');
    if (trip.status === 'CANCELLED') throw new AppError(409, 'TRIP_CANCELLED');

    // 2. участок
    const from = trip.stops.find((s) => s.stopOrder === dto.fromStopOrder);
    const to = trip.stops.find((s) => s.stopOrder === dto.toStopOrder);
    if (!from || !to || from.stopOrder >= to.stopOrder || !from.departureAt) throw new AppError(400, 'INVALID_JOURNEY');
    if (from.departureAt <= new Date()) throw new AppError(409, 'ALREADY_DEPARTED');

    // 3. место (вместе с классом его вагона)
    const seat = await tx.seat.findUnique({ where: { id: dto.seatId }, include: { carriage: true } });
    if (!seat || seat.trainId !== trip.trainId || !seat.isActive || !seat.carriage.isActive) {
      throw new AppError(404, 'NOT_FOUND', 'Место не найдено');
    }
    const seatClass = seat.carriage.seatClass;

    // 4. цена — только с сервера, по классу вагона
    const fare = await tx.fare.findUnique({
      where: {
        routeId_fromStopOrder_toStopOrder_seatClass: {
          routeId: trip.routeId,
          fromStopOrder: from.stopOrder,
          toStopOrder: to.stopOrder,
          seatClass,
        },
      },
    });
    if (!fare) throw new AppError(400, 'INVALID_JOURNEY');
    if (dto.expectedPrice !== undefined && !fare.price.equals(new Prisma.Decimal(dto.expectedPrice))) {
      throw new AppError(409, 'PRICE_CHANGED', undefined, { newPrice: { amount: fare.price.toFixed(2), currency: fare.currency } });
    }

    // 5. сохранить
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        userId: user.id,
        tripId: trip.id,
        seatId: seat.id,
        fromStopOrder: from.stopOrder,
        toStopOrder: to.stopOrder,
        price: fare.price,
        currency: fare.currency,
        passengerName: user.name,
        trainNumber: trip.train.number,
        carriageNo: seat.carriageNo,
        seatLabel: seat.seatLabel,
        seatClass,
        fromStationName: from.station.name,
        toStationName: to.station.name,
      },
    });
    const row = (await findTicketRow(tx, Number(ticket.id)))!;
    await audit.log(tx, userId, 'TICKET_BOOKED', 'ticket', ticket.id, {
      tripId: Number(trip.id), seat: seat.seatLabel, carriageNo: seat.carriageNo, from: from.stopOrder, to: to.stopOrder,
    });
    await queueEmail(tx, 'BOOKING_CONFIRMED', row);
    return toTicketDto(row);
  });
}

/** «Мои билеты» с вкладками и фильтрами (раздел 10.13) */
export async function listMyTickets(userId: number, q: MyTicketsQuery) {
  const where: Prisma.Sql[] = [Prisma.sql`k.user_id = ${userId}`];
  if (q.status === 'upcoming') where.push(Prisma.sql`k.status = 'CONFIRMED' AND fs.departure_at > now()`);
  if (q.status === 'completed') where.push(Prisma.sql`k.status = 'CONFIRMED' AND fs.departure_at <= now()`);
  if (q.status === 'cancelled') where.push(Prisma.sql`k.status = 'CANCELLED'`);
  if (q.dateFrom) where.push(Prisma.sql`(fs.departure_at AT TIME ZONE sf.timezone)::date >= ${q.dateFrom}::date`);
  if (q.dateTo) where.push(Prisma.sql`(fs.departure_at AT TIME ZONE sf.timezone)::date <= ${q.dateTo}::date`);
  if (q.q) {
    const like = `%${q.q}%`;
    where.push(Prisma.sql`(k.ticket_number ILIKE ${like} OR k.from_station_name ILIKE ${like} OR k.to_station_name ILIKE ${like})`);
  }
  const sort = q.sort ?? (q.status === 'upcoming' ? 'date_asc' : 'date_desc');
  const orderBy = sort === 'date_asc' ? Prisma.sql`fs.departure_at ASC, k.id` : Prisma.sql`fs.departure_at DESC, k.id DESC`;
  const { page, limit, offset } = paging(q.page, q.limit);
  const [rows, total] = await Promise.all([selectTickets(db, where, orderBy, limit, offset), countTickets(db, where)]);
  return { items: rows.map((r) => toTicketDto(r)), page, limit, total };
}

export async function getMyTicket(userId: number, ticketId: number) {
  const row = await findTicketRow(db, ticketId, userId);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Билет не найден');
  return toTicketDto(row);
}

/** Отмена билета пассажиром (раздел 10.5) — один безопасный UPDATE */
export async function cancelTicket(userId: number, ticketId: number) {
  return db.$transaction(async (tx) => {
    const updated = await tx.$queryRaw<{ id: bigint }[]>`
      UPDATE tickets k
         SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = 'PASSENGER'
        FROM trip_stops s
       WHERE k.id = ${ticketId}
         AND k.user_id = ${userId}
         AND k.status = 'CONFIRMED'
         AND s.trip_id = k.trip_id AND s.stop_order = k.from_stop_order
         AND s.departure_at > now()
      RETURNING k.id`;
    if (updated.length === 0) {
      const row = await findTicketRow(tx, ticketId, userId);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Билет не найден');
      if (row.status === 'CANCELLED') throw new AppError(409, 'ALREADY_CANCELLED');
      throw new AppError(409, 'ALREADY_DEPARTED');
    }
    const row = (await findTicketRow(tx, ticketId, userId))!;
    await audit.log(tx, userId, 'TICKET_CANCELLED', 'ticket', ticketId, { by: 'PASSENGER' });
    await queueEmail(tx, 'TICKET_CANCELLED', row);
    return toTicketDto(row);
  });
}

/** PDF-билет: пассажир — только свой, админ — любой (раздел 10.12) */
export async function getTicketPdf(user: { id: number; role: string }, ticketId: number) {
  const row = await findTicketRow(db, ticketId, user.role === 'ADMIN' ? undefined : user.id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Билет не найден');
  const pdf = await buildTicketPdf(row);
  return { pdf, fileName: `${row.ticket_number}.pdf` };
}
