import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');
const emptyToUndef = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' ? undefined : v), s);

export const adminTicketsQuerySchema = z
  .object({
    status: emptyToUndef(z.enum(['CONFIRMED', 'CANCELLED']).optional()),
    tripId: emptyToUndef(z.coerce.number().int().positive().optional()),
    trainNumber: emptyToUndef(z.string().trim().max(20).optional()),
    dateFrom: emptyToUndef(isoDate.optional()),
    dateTo: emptyToUndef(isoDate.optional()),
    stationId: emptyToUndef(z.coerce.number().int().positive().optional()),
    email: emptyToUndef(z.string().trim().max(255).optional()),
    ticketNumber: emptyToUndef(z.string().trim().max(20).optional()),
    sort: emptyToUndef(z.enum(['created_desc', 'departure_asc']).optional()),
    page: emptyToUndef(z.coerce.number().int().min(1).optional()),
    limit: emptyToUndef(z.coerce.number().int().min(1).max(100).optional()),
  })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, { message: 'Дата «до» раньше даты «от»', path: ['dateTo'] });

export type AdminTicketsQuery = z.infer<typeof adminTicketsQuerySchema>;
