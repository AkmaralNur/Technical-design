import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../utils/AppError';
import { timeOnly } from '../../utils/format';
import * as audit from '../audit/audit.service';
import type { createRouteSchema, setFaresSchema, StopInput, updateRouteSchema } from './routes.schema';

/** Проверка остановок: станции не повторяются, время каждой следующей остановки больше предыдущей */
async function normalizeStops(stops: StopInput[]) {
  const ids = stops.map((s) => s.stationId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'VALIDATION_ERROR', 'Станции в маршруте не должны повторяться');
  const stations = await db.station.findMany({ where: { id: { in: ids.map(BigInt) } } });
  if (stations.length !== ids.length) throw new AppError(404, 'STATION_NOT_FOUND');

  const last = stops.length - 1;
  const result = stops.map((s, i) => ({
    stationId: s.stationId,
    stopOrder: i,
    arrivalOffsetMin: i === 0 ? null : (s.arrivalOffsetMin ?? null),
    departureOffsetMin: i === last ? null : (s.departureOffsetMin ?? null),
  }));
  let prev = -1;
  for (const s of result) {
    const name = stations.find((st) => Number(st.id) === s.stationId)?.name;
    if (s.stopOrder > 0 && s.arrivalOffsetMin === null) throw new AppError(400, 'VALIDATION_ERROR', `Укажите время прибытия для «${name}»`);
    if (s.stopOrder < last && s.departureOffsetMin === null) throw new AppError(400, 'VALIDATION_ERROR', `Укажите время отправления для «${name}»`);
    if (s.arrivalOffsetMin !== null) {
      if (s.arrivalOffsetMin <= prev) throw new AppError(400, 'VALIDATION_ERROR', `Время прибытия в «${name}» должно быть позже предыдущей остановки`);
      prev = s.arrivalOffsetMin;
    }
    if (s.departureOffsetMin !== null) {
      if (s.departureOffsetMin < prev) {
        throw new AppError(400, 'VALIDATION_ERROR', `Отправление из «${name}» не может быть раньше прибытия`);
      }
      prev = s.departureOffsetMin;
    }
  }
  return result;
}

function toTime(hhmm: string) {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

/** Классы мест, которые есть в поезде (по активным вагонам) */
async function trainClasses(trainId: bigint) {
  const rows = await db.carriage.findMany({ where: { trainId, isActive: true }, select: { seatClass: true }, distinct: ['seatClass'] });
  return rows.map((r) => r.seatClass).sort();
}

/** Пары остановок без цены — для каждого класса поезда */
export async function missingFares(routeId: bigint, trainId: bigint) {
  const [stopsCount, fares, classes] = await Promise.all([
    db.routeStop.count({ where: { routeId } }),
    db.fare.findMany({ where: { routeId } }),
    trainClasses(trainId),
  ]);
  const have = new Set(fares.map((f) => `${f.fromStopOrder}-${f.toStopOrder}-${f.seatClass}`));
  const missing: { from: number; to: number; seatClass: string }[] = [];
  for (const seatClass of classes) {
    for (let from = 0; from < stopsCount; from++) {
      for (let to = from + 1; to < stopsCount; to++) {
        if (!have.has(`${from}-${to}-${seatClass}`)) missing.push({ from, to, seatClass });
      }
    }
  }
  return { missing, classes };
}

export async function list() {
  const routes = await db.route.findMany({
    orderBy: { id: 'asc' },
    include: {
      train: true,
      stops: { orderBy: { stopOrder: 'asc' }, include: { station: true } },
      _count: { select: { trips: true } },
    },
  });
  return Promise.all(
    routes.map(async (r) => ({
      id: Number(r.id),
      name: r.name,
      trainId: Number(r.trainId),
      trainNumber: r.train.number,
      departureTime: timeOnly(r.departureTime),
      timezone: r.timezone,
      isActive: r.isActive,
      stops: r.stops.map((s) => s.station.name),
      tripsCount: r._count.trips,
      missingFares: (await missingFares(r.id, r.trainId)).missing.length,
    })),
  );
}

export async function get(id: number) {
  const r = await db.route.findUnique({
    where: { id },
    include: {
      train: true,
      stops: { orderBy: { stopOrder: 'asc' }, include: { station: true } },
      fares: { orderBy: [{ seatClass: 'asc' }, { fromStopOrder: 'asc' }, { toStopOrder: 'asc' }] },
      _count: { select: { trips: true } },
    },
  });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Маршрут не найден');
  const { missing, classes } = await missingFares(r.id, r.trainId);
  return {
    id: Number(r.id),
    name: r.name,
    trainId: Number(r.trainId),
    trainNumber: r.train.number,
    departureTime: timeOnly(r.departureTime),
    timezone: r.timezone,
    isActive: r.isActive,
    tripsCount: r._count.trips,
    classes,
    stops: r.stops.map((s) => ({
      stopOrder: s.stopOrder,
      stationId: Number(s.stationId),
      name: s.station.name,
      code: s.station.code,
      arrivalOffsetMin: s.arrivalOffsetMin,
      departureOffsetMin: s.departureOffsetMin,
    })),
    fares: r.fares.map((f) => ({ from: f.fromStopOrder, to: f.toStopOrder, seatClass: f.seatClass, price: f.price.toFixed(2), currency: f.currency })),
    currency: r.fares[0]?.currency ?? 'EUR',
    missing,
  };
}

export async function create(adminId: number, dto: z.infer<typeof createRouteSchema>) {
  const train = await db.train.findUnique({ where: { id: dto.trainId } });
  if (!train) throw new AppError(404, 'NOT_FOUND', 'Поезд не найден');
  const stops = await normalizeStops(dto.stops);
  const route = await db.$transaction(async (tx) => {
    const r = await tx.route.create({
      data: { trainId: dto.trainId, name: dto.name, departureTime: toTime(dto.departureTime), timezone: dto.timezone },
    });
    await tx.routeStop.createMany({ data: stops.map((s) => ({ ...s, routeId: r.id, stationId: BigInt(s.stationId) })) });
    await audit.log(tx, adminId, 'ROUTE_CREATED', 'route', r.id, { name: dto.name, stops: stops.length });
    return r;
  });
  return get(Number(route.id));
}

export async function update(adminId: number, id: number, dto: z.infer<typeof updateRouteSchema>) {
  const r = await db.route.findUnique({ where: { id } });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Маршрут не найден');
  await db.route.update({
    where: { id },
    data: { ...dto, departureTime: dto.departureTime ? toTime(dto.departureTime) : undefined },
  });
  await audit.log(db, adminId, 'ROUTE_UPDATED', 'route', id, dto);
  return get(id);
}

/** Изменить остановки шаблона. Уже созданные рейсы не меняются (у них свои trip_stops) */
export async function updateStops(adminId: number, id: number, input: StopInput[]) {
  const r = await db.route.findUnique({ where: { id }, include: { stops: true } });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Маршрут не найден');
  const stops = await normalizeStops(input);
  const oldStation = new Map(r.stops.map((s) => [s.stopOrder, Number(s.stationId)]));
  const newStation = new Map(stops.map((s) => [s.stopOrder, s.stationId]));
  await db.$transaction(async (tx) => {
    await tx.routeStop.deleteMany({ where: { routeId: id } });
    await tx.routeStop.createMany({ data: stops.map((s) => ({ ...s, routeId: BigInt(id), stationId: BigInt(s.stationId) })) });
    // цены остаются только для пар, где станции не изменились
    const fares = await tx.fare.findMany({ where: { routeId: id } });
    const stale = fares.filter(
      (f) =>
        oldStation.get(f.fromStopOrder) !== newStation.get(f.fromStopOrder) ||
        oldStation.get(f.toStopOrder) !== newStation.get(f.toStopOrder) ||
        newStation.get(f.toStopOrder) === undefined,
    );
    if (stale.length) await tx.fare.deleteMany({ where: { id: { in: stale.map((f) => f.id) } } });
    await audit.log(tx, adminId, 'ROUTE_UPDATED', 'route', id, { stops: stops.length, faresRemoved: stale.length });
  });
  return get(id);
}

/** Задать цены для пар остановок и классов (раздел 9.6, п. 26) */
export async function setFares(adminId: number, id: number, dto: z.infer<typeof setFaresSchema>) {
  const r = await db.route.findUnique({ where: { id }, include: { _count: { select: { stops: true } } } });
  if (!r) throw new AppError(404, 'NOT_FOUND', 'Маршрут не найден');
  const n = r._count.stops;
  for (const f of dto.fares) {
    if (f.from >= f.to || f.to >= n) throw new AppError(400, 'VALIDATION_ERROR', `Неверная пара остановок ${f.from} → ${f.to}`);
  }
  await db.$transaction(async (tx) => {
    for (const f of dto.fares) {
      const key = { routeId: BigInt(id), fromStopOrder: f.from, toStopOrder: f.to, seatClass: f.seatClass };
      await tx.fare.upsert({
        where: { routeId_fromStopOrder_toStopOrder_seatClass: key },
        create: { ...key, price: new Prisma.Decimal(f.price), currency: dto.currency },
        update: { price: new Prisma.Decimal(f.price), currency: dto.currency },
      });
    }
    await audit.log(tx, adminId, 'FARES_UPDATED', 'route', id, { count: dto.fares.length });
  });
  return get(id);
}
