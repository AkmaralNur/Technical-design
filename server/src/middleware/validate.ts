import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

/** Проверяет тело запроса по схеме zod. Ошибка → 400 VALIDATION_ERROR (через errorHandler) */
export const validate = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  req.body = schema.parse(req.body ?? {});
  next();
};
