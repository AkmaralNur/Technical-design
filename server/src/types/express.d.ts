import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Текущий пользователь — заполняется middleware authenticate */
      user?: { id: number; role: 'PASSENGER' | 'ADMIN' };
    }
  }
}

export {};
