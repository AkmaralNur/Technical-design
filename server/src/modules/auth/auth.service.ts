import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { db } from '../../db/client';
import { AppError } from '../../utils/AppError';
import * as audit from '../audit/audit.service';
import type { loginSchema, registerSchema } from './auth.schema';

function toUserDto(u: { id: bigint; name: string; email: string; role: string; createdAt: Date }) {
  return { id: Number(u.id), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}

/** Регистрация (раздел 12.1). Роль из запроса игнорируется — всегда PASSENGER */
export async function register(dto: z.infer<typeof registerSchema>) {
  const exists = await db.user.findUnique({ where: { email: dto.email } });
  if (exists) throw new AppError(409, 'EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(dto.password, 12);
  const user = await db.user.create({ data: { name: dto.name, email: dto.email, passwordHash, role: 'PASSENGER' } });
  await audit.log(db, user.id, 'USER_REGISTERED', 'user', user.id);
  return toUserDto(user);
}

/** Вход (раздел 12.2): одна и та же ошибка, если нет пользователя или неверный пароль */
export async function login(dto: z.infer<typeof loginSchema>) {
  const user = await db.user.findUnique({ where: { email: dto.email } });
  const ok = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS');
  return toUserDto(user);
}

export async function getMe(userId: number) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, 'UNAUTHENTICATED');
  return toUserDto(user);
}
