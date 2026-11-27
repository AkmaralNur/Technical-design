import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { AppError } from '../utils/AppError';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Защита от CSRF: изменяющие запросы принимаем только с нашего сайта (раздел 12.4) */
export function checkOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // запросы не из браузера (curl, тесты)
  const allowed = [config.corsOrigin, config.appUrl, `http://localhost:${config.port}`, `${req.protocol}://${req.get('host')}`];
  if (!allowed.includes(origin)) throw new AppError(403, 'FORBIDDEN');
  next();
}
