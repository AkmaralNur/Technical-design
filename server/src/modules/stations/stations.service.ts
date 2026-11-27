import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../utils/AppError';
import * as audit from '../audit/audit.service';
import type { createStationSchema, updateStationSchema } from './stations.schema';

/** Для поиска — только активные станции */
export function listActive() {
  return db.station.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true, city: true, timezone: true },
  });
}

export function listAll() {
  return db.station.findMany({ orderBy: { name: 'asc' } });
}

export async function create(adminId: number, dto: z.infer<typeof createStationSchema>) {
  const exists = await db.station.findUnique({ where: { code: dto.code } });
  if (exists) throw new AppError(409, 'DUPLICATE', `Станция с кодом ${dto.code} уже есть`);
  const station = await db.station.create({ data: dto });
  await audit.log(db, adminId, 'STATION_CREATED', 'station', station.id, dto);
  return station;
}

/** Изменение станции. В старых билетах название не меняется — там копия */
export async function update(adminId: number, id: number, dto: z.infer<typeof updateStationSchema>) {
  const station = await db.station.findUnique({ where: { id } });
  if (!station) throw new AppError(404, 'STATION_NOT_FOUND');
  if (dto.code && dto.code !== station.code) {
    const exists = await db.station.findUnique({ where: { code: dto.code } });
    if (exists) throw new AppError(409, 'DUPLICATE', `Станция с кодом ${dto.code} уже есть`);
  }
  const updated = await db.station.update({ where: { id }, data: dto });
  await audit.log(db, adminId, 'STATION_UPDATED', 'station', id, { before: station, after: dto });
  return updated;
}
