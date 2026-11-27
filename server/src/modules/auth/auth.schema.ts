import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Имя — от 2 до 100 символов').max(100, 'Имя — от 2 до 100 символов'),
  email: z.string().trim().toLowerCase().email('Неверный формат email').max(255),
  password: z
    .string()
    .min(8, 'Пароль — минимум 8 символов')
    .max(100)
    .regex(/[A-Za-zА-Яа-яЁё]/, 'В пароле должна быть буква')
    .regex(/\d/, 'В пароле должна быть цифра'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Неверный формат email'),
  password: z.string().min(1, 'Введите пароль'),
});
