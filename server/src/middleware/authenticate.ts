import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/AppError';

interface TokenPayload {
  sub: string;
  role: 'PASSENGER' | 'ADMIN';
}

/** Проверка входа: читает cookie token (раздел 12.3). Нет токена → 401 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) throw new AppError(401, 'UNAUTHENTICATED');
  try {
    const payload = jwt.verify(token, config.jwtSecret) as unknown as TokenPayload;
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED');
  }
}

/** Проверка роли: для /api/admin/* нужен ADMIN, иначе 403 */
export const requireRole =
  (role: 'ADMIN' | 'PASSENGER') =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) throw new AppError(403, 'FORBIDDEN');
    next();
  };

export function signToken(user: { id: bigint | number; role: string }) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};
