import { z } from 'zod';

const offset = z.coerce.number().int().min(0).max(10080).nullable().optional();

export const stopSchema = z.object({
  stationId: z.coerce.number().int().positive(),
  arrivalOffsetMin: offset,
  departureOffsetMin: offset,
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');

export const createRouteSchema = z.object({
  trainId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2, 'Название — минимум 2 символа').max(150),
  departureTime: time,
  timezone: z.string().trim().max(50).default('Europe/Prague'),
  stops: z.array(stopSchema).min(2, 'Минимум 2 остановки').max(30),
});

export const updateRouteSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  departureTime: time.optional(),
  timezone: z.string().trim().max(50).optional(),
  isActive: z.boolean().optional(),
});

export const updateStopsSchema = z.object({ stops: z.array(stopSchema).min(2, 'Минимум 2 остановки').max(30) });

export const setFaresSchema = z.object({
  currency: z.string().trim().toUpperCase().length(3).default('EUR'),
  fares: z
    .array(
      z.object({
        from: z.coerce.number().int().min(0),
        to: z.coerce.number().int().min(1),
        seatClass: z.enum(['ECONOMY', 'BUSINESS']),
        price: z.union([z.string(), z.number()]).transform(String).refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Цена — число ≥ 0, максимум 2 знака после точки'),
      }),
    )
    .max(1000),
});

export type StopInput = z.infer<typeof stopSchema>;
