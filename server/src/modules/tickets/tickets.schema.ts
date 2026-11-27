import { z } from 'zod';

export const bookTicketSchema = z.object({
  tripId: z.coerce.number().int().positive(),
  seatId: z.coerce.number().int().positive(),
  fromStopOrder: z.coerce.number().int().min(0),
  toStopOrder: z.coerce.number().int().min(0),
  expectedPrice: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Неверный формат цены')
    .optional(),
});
export type BookTicketDto = z.infer<typeof bookTicketSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');

export const myTicketsQuerySchema = z
  .object({
    status: z.enum(['upcoming', 'completed', 'cancelled']).optional(),
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['date_asc', 'date_desc']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, { message: 'Дата «до» раньше даты «от»', path: ['dateTo'] });
export type MyTicketsQuery = z.infer<typeof myTicketsQuerySchema>;

export const idParam = z.coerce.number().int().positive();
