import type { Money, SeatClass } from '../api/types';

/** Время по местному времени станции: '07:00' (раздел 17.7) */
export function fmtTime(iso: string | null | undefined, timeZone: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Дата по местному времени станции: '05.12.2026' */
export function fmtDate(iso: string | null | undefined, timeZone: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

/** '2026-12-05' → '5 декабря 2026' */
export function fmtLongDate(isoDate: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** '2026-12-05' → 'сб, 5 дек.' */
export function fmtShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

export function fmtDuration(min: number | null | undefined) {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} ч${m ? ` ${m} мин` : ''}` : `${m} мин`;
}

export function fmtMoney(m: Money | null | undefined) {
  return m ? `${m.amount} ${m.currency}` : '—';
}

export const SEAT_CLASS_RU: Record<SeatClass, string> = { ECONOMY: 'Эконом', BUSINESS: 'Бизнес' };

/** Склонение: 1 место, 2 места, 5 мест */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const seatsWord = (n: number) => `${n} ${plural(n, 'место', 'места', 'мест')}`;

/** Сегодняшняя дата 'YYYY-MM-DD' (по часовому поясу станций TrainTix) */
export function todayIso(timeZone = 'Europe/Prague') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Смещение в минутах от старта → 'ЧЧ:ММ' (для редактора маршрута) */
export function offsetToClock(start: string, offset: number | null | undefined) {
  if (offset === null || offset === undefined || !/^\d{2}:\d{2}$/.test(start)) return '';
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + offset;
  const days = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}${days > 0 ? ` (+${days} д)` : ''}`;
}
