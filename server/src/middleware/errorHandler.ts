import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, isPgError, MESSAGES } from '../utils/AppError';
import { logger } from '../utils/logger';

/** Единая обработка ошибок (раздел 13.1). Пользователь видит только code и message. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: MESSAGES.VALIDATION_ERROR,
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
  }
  if (isPgError(err, '23P01')) {
    return res.status(409).json({ error: { code: 'SEAT_UNAVAILABLE', message: MESSAGES.SEAT_UNAVAILABLE, details: null } });
  }
  if (isPgError(err, '23505')) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: MESSAGES.DUPLICATE, details: null } });
  }
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Неверный JSON в запросе', details: null } });
  }
  (req.log ?? logger).error({ err }, 'unexpected error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: MESSAGES.INTERNAL_ERROR, details: null } });
}
