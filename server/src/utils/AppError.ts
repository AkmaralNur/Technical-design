/** Сообщения пользователю для всех кодов ошибок (раздел 13.2) */
export const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Проверьте введённые данные',
  SAME_STATIONS: 'Станции отправления и прибытия должны быть разными',
  INVALID_JOURNEY: 'Этот поезд не едет между выбранными станциями в этом направлении',
  UNAUTHENTICATED: 'Войдите в аккаунт, чтобы продолжить',
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  FORBIDDEN: 'У вас нет доступа к этой странице',
  NOT_FOUND: 'Не найдено',
  STATION_NOT_FOUND: 'Станция не найдена',
  EMAIL_TAKEN: 'Этот email уже зарегистрирован',
  DUPLICATE: 'Такая запись уже существует',
  SEAT_UNAVAILABLE: 'Это место уже занято на выбранном участке. Выберите другое место',
  PRICE_CHANGED: 'Цена изменилась. Проверьте новую цену и подтвердите ещё раз',
  ALREADY_DEPARTED: 'Поезд уже отправился',
  ALREADY_CANCELLED: 'Билет уже отменён',
  TRIP_CANCELLED: 'Этот рейс отменён',
  HAS_CONFIRMED_TICKETS: 'На это уже проданы билеты. Изменение невозможно / требует подтверждения',
  FARES_MISSING: 'Заполните цены для всех участков и классов маршрута',
  ROUTE_INACTIVE: 'Маршрут выключен — новые рейсы создать нельзя',
  TOO_MANY_REQUESTS: 'Слишком много попыток. Подождите несколько минут',
  INTERNAL_ERROR: 'Что-то пошло не так. Попробуйте ещё раз',
};

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? MESSAGES[code] ?? 'Ошибка');
  }
}

/** Проверка кода ошибки PostgreSQL (23P01 — EXCLUDE, 23505 — UNIQUE), в т.ч. обёрнутой Prisma */
export function isPgError(e: unknown, code: string): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; meta?: { code?: string }; message?: string };
  if (err.code === code || err.meta?.code === code) return true;
  if (code === '23P01' && err.message?.includes('no_double_booking')) return true;
  if (code === '23505' && err.code === 'P2002') return true;
  return typeof err.message === 'string' && err.message.includes(code);
}
