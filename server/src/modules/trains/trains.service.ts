import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../utils/AppError';
import { buildSeats } from '../../utils/segments';
import * as audit from '../audit/audit.service';
import type { addCarriageSchema, createTrainSchema, updateCarriageSchema, updateSeatSchema, updateTrainSchema } from './trains.schema';

interface FutureTicket {
  id: bigint;
  ticket_number: string;
  carriage_no: number;
  seat_label: string;
  seat_id: bigint;
}

/** Будущие подтверждённые билеты по условию на место s.* */
function futureTickets(cond: Prisma.Sql) {
  return db.$queryRaw<FutureTicket[]>`
    SELECT k.id, k.ticket_number, k.carriage_no, k.seat_label, k.seat_id
      FROM tickets k
      JOIN seats s       ON s.id = k.seat_id
      JOIN trip_stops fs ON fs.trip_id = k.trip_id AND fs.stop_order = k.from_stop_order
     WHERE k.status = 'CONFIRMED' AND fs.departure_at > now() AND ${cond}
     ORDER BY fs.departure_at`;
}

function ticketsDetails(list: FutureTicket[]) {
  return { ticketsCount: list.length, tickets: list.slice(0, 50).map((t) => ({ id: Number(t.id), ticketNumber: t.ticket_number, carriageNo: t.carriage_no, seatLabel: t.seat_label })) };
}

export async function list() {
  const trains = await db.train.findMany({
    orderBy: { number: 'asc' },
    include: { carriages: { orderBy: { carriageNo: 'asc' } }, _count: { select: { seats: { where: { isActive: true } }, routes: true } } },
  });
  return trains.map((t) => ({
    id: Number(t.id),
    number: t.number,
    name: t.name,
    isActive: t.isActive,
    carriagesCount: t.carriages.length,
    seatsCount: t._count.seats,
    routesCount: t._count.routes,
    classes: [...new Set(t.carriages.filter((c) => c.isActive).map((c) => c.seatClass))],
  }));
}

export async function create(adminId: number, dto: z.infer<typeof createTrainSchema>) {
  if (await db.train.findUnique({ where: { number: dto.number } })) {
    throw new AppError(409, 'DUPLICATE', `Поезд ${dto.number} уже есть`);
  }
  const train = await db.train.create({ data: dto });
  await audit.log(db, adminId, 'TRAIN_CREATED', 'train', train.id, dto);
  return train;
}

export async function update(adminId: number, id: number, dto: z.infer<typeof updateTrainSchema>) {
  const train = await db.train.findUnique({ where: { id } });
  if (!train) throw new AppError(404, 'NOT_FOUND', 'Поезд не найден');
  if (dto.number && dto.number !== train.number && (await db.train.findUnique({ where: { number: dto.number } }))) {
    throw new AppError(409, 'DUPLICATE', `Поезд ${dto.number} уже есть`);
  }
  if (dto.isActive === false && train.isActive) {
    const list = await futureTickets(Prisma.sql`s.train_id = ${id}`);
    if (list.length) throw new AppError(409, 'HAS_CONFIRMED_TICKETS', 'На этот поезд проданы билеты — выключить его нельзя', ticketsDetails(list));
  }
  const updated = await db.train.update({ where: { id }, data: dto });
  await audit.log(db, adminId, 'TRAIN_UPDATED', 'train', id, dto);
  return updated;
}

/** Вагоны и места поезда (для админки) */
export async function getCarriages(trainId: number) {
  const train = await db.train.findUnique({
    where: { id: trainId },
    include: {
      carriages: {
        orderBy: { carriageNo: 'asc' },
        include: { seats: { orderBy: [{ rowNo: 'asc' }, { seatLetter: 'asc' }] } },
      },
    },
  });
  if (!train) throw new AppError(404, 'NOT_FOUND', 'Поезд не найден');
  const booked = await futureTickets(Prisma.sql`s.train_id = ${trainId}`);
  const bookedSeats = new Set(booked.map((b) => Number(b.seat_id)));
  return {
    id: Number(train.id),
    number: train.number,
    name: train.name,
    isActive: train.isActive,
    carriages: train.carriages.map((c) => ({
      id: Number(c.id),
      carriageNo: c.carriageNo,
      seatClass: c.seatClass,
      rowsCount: c.rowsCount,
      layout: c.layout,
      isActive: c.isActive,
      seats: c.seats.map((s) => ({
        seatId: Number(s.id),
        label: s.seatLabel,
        row: s.rowNo,
        letter: s.seatLetter,
        isActive: s.isActive,
        hasFutureTickets: bookedSeats.has(Number(s.id)),
      })),
    })),
  };
}

/** Добавить вагон — места создаются автоматически по схеме (раздел 10.10) */
export async function addCarriage(adminId: number, trainId: number, dto: z.infer<typeof addCarriageSchema>) {
  const train = await db.train.findUnique({ where: { id: trainId } });
  if (!train) throw new AppError(404, 'NOT_FOUND', 'Поезд не найден');
  const exists = await db.carriage.findUnique({ where: { trainId_carriageNo: { trainId, carriageNo: dto.carriageNo } } });
  if (exists) throw new AppError(409, 'DUPLICATE', `Вагон ${dto.carriageNo} уже есть в поезде ${train.number}`);
  const seats = buildSeats(trainId, dto.carriageNo, dto.rowsCount, dto.layout);
  const carriage = await db.$transaction(async (tx) => {
    const c = await tx.carriage.create({ data: { trainId, ...dto } });
    await tx.seat.createMany({ data: seats });
    await audit.log(tx, adminId, 'CARRIAGE_ADDED', 'carriage', c.id, { trainId, ...dto, seats: seats.length });
    return c;
  });
  return { ...carriage, seatsCreated: seats.length };
}

/** Изменить класс / выключить вагон — запрещено, если есть будущие билеты (раздел 10.8) */
export async function updateCarriage(adminId: number, id: number, dto: z.infer<typeof updateCarriageSchema>) {
  const c = await db.carriage.findUnique({ where: { id } });
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Вагон не найден');
  const classChanges = dto.seatClass !== undefined && dto.seatClass !== c.seatClass;
  const disabling = dto.isActive === false && c.isActive;
  if (classChanges || disabling) {
    const list = await futureTickets(Prisma.sql`s.train_id = ${c.trainId} AND s.carriage_no = ${c.carriageNo}`);
    if (list.length) {
      throw new AppError(409, 'HAS_CONFIRMED_TICKETS', `В вагоне ${c.carriageNo} есть проданные билеты — изменение невозможно`, ticketsDetails(list));
    }
  }
  const updated = await db.carriage.update({ where: { id }, data: dto });
  await audit.log(db, adminId, 'CARRIAGE_UPDATED', 'carriage', id, dto);
  return updated;
}

/** Включить / выключить место. Места не удаляются (раздел 8.4) */
export async function updateSeat(adminId: number, id: number, dto: z.infer<typeof updateSeatSchema>) {
  const seat = await db.seat.findUnique({ where: { id } });
  if (!seat) throw new AppError(404, 'NOT_FOUND', 'Место не найдено');
  if (!dto.isActive && seat.isActive) {
    const list = await futureTickets(Prisma.sql`s.id = ${id}`);
    if (list.length) throw new AppError(409, 'HAS_CONFIRMED_TICKETS', `На место ${seat.seatLabel} проданы билеты`, ticketsDetails(list));
  }
  const updated = await db.seat.update({ where: { id }, data: { isActive: dto.isActive } });
  await audit.log(db, adminId, 'SEAT_UPDATED', 'seat', id, dto);
  return updated;
}
