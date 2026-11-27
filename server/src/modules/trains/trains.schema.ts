import { z } from 'zod';

export const createTrainSchema = z.object({
  number: z.string().trim().toUpperCase().min(1, 'Укажите номер поезда').max(20),
  name: z.string().trim().max(100).optional().nullable(),
});

export const updateTrainSchema = createTrainSchema.partial().extend({ isActive: z.boolean().optional() });

export const seatClassSchema = z.enum(['ECONOMY', 'BUSINESS']);

export const addCarriageSchema = z.object({
  carriageNo: z.coerce.number().int().min(1, 'Номер вагона > 0').max(99),
  seatClass: seatClassSchema,
  rowsCount: z.coerce.number().int().min(1, 'Минимум 1 ряд').max(40, 'Максимум 40 рядов'),
  layout: z
    .string()
    .trim()
    .toUpperCase()
    .max(10, 'Схема — максимум 10 символов')
    .regex(/^[A-Z_]+$/, 'Схема — только буквы и _ (пример: AB_CD)')
    .refine((l) => /[A-Z]/.test(l), 'В схеме должно быть хотя бы одно место')
    .refine((l) => {
      const letters = l.replace(/_/g, '');
      return new Set(letters).size === letters.length;
    }, 'Буквы мест в схеме не должны повторяться'),
});

export const updateCarriageSchema = z.object({
  seatClass: seatClassSchema.optional(),
  isActive: z.boolean().optional(),
});

export const updateSeatSchema = z.object({ isActive: z.boolean() });
