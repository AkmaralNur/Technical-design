import { z } from 'zod';

const timezone = z
  .string()
  .trim()
  .max(50)
  .refine((tz) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Неизвестный часовой пояс (пример: Europe/Prague)');

export const createStationSchema = z.object({
  code: z.string().trim().toUpperCase().min(2, 'Код — от 2 до 10 символов').max(10).regex(/^[A-Z0-9]+$/, 'Код — только латинские буквы и цифры'),
  name: z.string().trim().min(2, 'Название — минимум 2 символа').max(100),
  city: z.string().trim().max(100).optional().nullable(),
  timezone: timezone.default('Europe/Prague'),
});

export const updateStationSchema = createStationSchema.partial().extend({ isActive: z.boolean().optional() });
