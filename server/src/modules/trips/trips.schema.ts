import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ');
const bool = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).transform((v) => v === true || v === 'true' || v === '1');

export const searchSchema = z.object({
  from: z.coerce.number().int().positive('Выберите станцию отправления'),
  to: z.coerce.number().int().positive('Выберите станцию прибытия'),
  date: isoDate,
  departAfter: hhmm.optional().or(z.literal('').transform(() => undefined)),
  departBefore: hhmm.optional().or(z.literal('').transform(() => undefined)),
  seatClass: z.enum(['ECONOMY', 'BUSINESS']).optional().or(z.literal('').transform(() => undefined)),
  maxPrice: z.coerce.number().min(0, 'Цена ≥ 0').optional().or(z.literal('').transform(() => undefined)),
  onlyAvailable: bool.optional(),
  sort: z.enum(['departure', 'price', 'duration']).optional(),
});
export type SearchQuery = z.infer<typeof searchSchema>;

export const journeySchema = z.object({
  from: z.coerce.number().int().min(0),
  to: z.coerce.number().int().min(0),
});

export const optionalJourneySchema = z.object({
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
});

export const createTripsSchema = z
  .object({
    routeId: z.coerce.number().int().positive(),
    dateFrom: isoDate,
    dateTo: isoDate,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'Выберите хотя бы один день недели').default([1, 2, 3, 4, 5, 6, 7]),
  })
  .refine((v) => v.dateFrom <= v.dateTo, { message: 'Дата «до» раньше даты «от»', path: ['dateTo'] });

export const adminTripsQuerySchema = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  routeId: z.coerce.number().int().positive().optional(),
  status: z.enum(['SCHEDULED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateScheduleSchema = z.object({
  stops: z
    .array(
      z.object({
        stopOrder: z.number().int().min(0),
        arrivalAt: z.string().datetime({ offset: true }).nullable().optional(),
        departureAt: z.string().datetime({ offset: true }).nullable().optional(),
      }),
    )
    .min(1),
  confirm: z.boolean().default(false),
});

export const cancelTripSchema = z.object({
  reason: z.string().trim().min(3, 'Укажите причину отмены').max(255),
  confirm: z.boolean().default(false),
});
