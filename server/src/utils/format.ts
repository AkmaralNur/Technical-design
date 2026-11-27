import { Prisma } from '@prisma/client';

/** Деньги: строка с 2 знаками + валюта (раздел 9.1) */
export function money(amount: Prisma.Decimal | number | string, currency: string) {
  return { amount: new Prisma.Decimal(amount).toFixed(2), currency: currency.trim() };
}

/** DATE из БД → 'YYYY-MM-DD' */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** TIME из БД (1970-01-01THH:MM) → 'HH:MM' */
export function timeOnly(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/** Местное время станции, например '07:00' */
export function localTime(d: Date | null | undefined, timeZone: string): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Местная дата станции, например '05.12.2026' */
export function localDate(d: Date | null | undefined, timeZone: string): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('ru-RU', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Местная дата в формате 'YYYY-MM-DD' */
export function localIsoDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export const SEAT_CLASS_RU: Record<string, string> = { ECONOMY: 'Эконом', BUSINESS: 'Бизнес' };

/** Пагинация: page с 1, limit по умолчанию 20, максимум 100 */
export function paging(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(100, Math.max(1, limit ?? 20));
  return { page: p, limit: l, offset: (p - 1) * l };
}
