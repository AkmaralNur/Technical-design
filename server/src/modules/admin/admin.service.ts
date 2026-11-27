import { Prisma } from '@prisma/client';
import { db } from '../../db/client';
import { localDate, localTime, paging, SEAT_CLASS_RU } from '../../utils/format';
import { countTickets, selectTickets, toTicketDto } from '../tickets/tickets.repository';
import type { AdminTicketsQuery } from './admin.schema';

/** Условия фильтров бронирований (раздел 10.13, п. 3). Только параметры — без склейки строк */
function buildWhere(q: AdminTicketsQuery): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  if (q.status) where.push(Prisma.sql`k.status = ${q.status}::ticket_status`);
  if (q.tripId) where.push(Prisma.sql`k.trip_id = ${q.tripId}`);
  if (q.trainNumber) where.push(Prisma.sql`k.train_number ILIKE ${q.trainNumber}`);
  if (q.dateFrom) where.push(Prisma.sql`(fs.departure_at AT TIME ZONE sf.timezone)::date >= ${q.dateFrom}::date`);
  if (q.dateTo) where.push(Prisma.sql`(fs.departure_at AT TIME ZONE sf.timezone)::date <= ${q.dateTo}::date`);
  if (q.stationId) where.push(Prisma.sql`(fs.station_id = ${q.stationId} OR ts.station_id = ${q.stationId})`);
  if (q.email) where.push(Prisma.sql`u.email ILIKE ${`%${q.email}%`}`);
  if (q.ticketNumber) where.push(Prisma.sql`k.ticket_number ILIKE ${`%${q.ticketNumber}%`}`);
  return where;
}

function orderBy(q: AdminTicketsQuery) {
  return q.sort === 'departure_asc' ? Prisma.sql`fs.departure_at ASC, k.id` : Prisma.sql`k.created_at DESC, k.id DESC`;
}

export async function listAllTickets(q: AdminTicketsQuery) {
  const where = buildWhere(q);
  const { page, limit, offset } = paging(q.page, q.limit);
  const [rows, total] = await Promise.all([selectTickets(db, where, orderBy(q), limit, offset), countTickets(db, where)]);
  return { items: rows.map((r) => toTicketDto(r, { withEmail: true })), page, limit, total };
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Выгрузка в CSV с теми же фильтрами (раздел 9.6, п. 33). BOM — чтобы Excel правильно показал кириллицу */
export async function exportTicketsCsv(q: AdminTicketsQuery) {
  const rows = await selectTickets(db, buildWhere(q), orderBy(q), 10_000, 0);
  const header = ['Номер билета', 'Статус', 'Пассажир', 'Email', 'Поезд', 'Дата', 'Откуда', 'Отправление', 'Куда', 'Прибытие', 'Вагон', 'Место', 'Класс', 'Цена', 'Валюта', 'Дата покупки'];
  const lines = rows.map((r) =>
    [
      r.ticket_number,
      r.status === 'CONFIRMED' ? 'Подтверждён' : 'Отменён',
      r.passenger_name,
      r.user_email,
      r.train_number,
      localDate(r.departure_at, r.from_tz),
      r.from_station_name,
      localTime(r.departure_at, r.from_tz),
      r.to_station_name,
      localTime(r.arrival_at, r.to_tz),
      r.carriage_no,
      r.seat_label,
      SEAT_CLASS_RU[r.seat_class],
      new Prisma.Decimal(r.price).toFixed(2),
      r.currency,
      r.created_at.toISOString(),
    ]
      .map(csvCell)
      .join(';'),
  );
  return '﻿' + [header.join(';'), ...lines].join('\r\n');
}

/** Короткая сводка для главной страницы админки */
export async function stats() {
  const [stations, trains, routes, upcomingTrips, confirmed, cancelled, revenue, users, emails] = await Promise.all([
    db.station.count({ where: { isActive: true } }),
    db.train.count({ where: { isActive: true } }),
    db.route.count({ where: { isActive: true } }),
    db.trip.count({ where: { status: 'SCHEDULED', serviceDate: { gte: new Date(new Date().toISOString().slice(0, 10)) } } }),
    db.ticket.count({ where: { status: 'CONFIRMED' } }),
    db.ticket.count({ where: { status: 'CANCELLED' } }),
    db.ticket.aggregate({ where: { status: 'CONFIRMED' }, _sum: { price: true } }),
    db.user.count({ where: { role: 'PASSENGER' } }),
    db.emailOutbox.groupBy({ by: ['status'], _count: true }),
  ]);
  return {
    stations,
    trains,
    routes,
    upcomingTrips,
    ticketsConfirmed: confirmed,
    ticketsCancelled: cancelled,
    revenue: (revenue._sum.price ?? new Prisma.Decimal(0)).toFixed(2),
    passengers: users,
    emails: Object.fromEntries(emails.map((e) => [e.status, e._count])),
  };
}

/** Последние записи журнала действий */
export async function auditLog(limit = 50) {
  const rows = await db.auditLog.findMany({ orderBy: { id: 'desc' }, take: Math.min(200, limit), include: { user: { select: { email: true } } } });
  return rows.map((r) => ({ id: Number(r.id), action: r.action, entity: r.entity, entityId: r.entityId === null ? null : Number(r.entityId), user: r.user?.email ?? null, details: r.details, createdAt: r.createdAt }));
}
