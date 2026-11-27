import type { SeatClass } from '../api/types';

/** Выбранное место хранится в sessionStorage — не теряется, если нужно войти (раздел 17.5) */
export interface BookingSelection {
  tripId: number;
  seatId: number;
  fromStopOrder: number;
  toStopOrder: number;
  seatLabel: string;
  carriageNo: number;
  seatClass: SeatClass;
  price: string;
  currency: string;
  trainNumber: string;
  trainName: string | null;
  date: string;
  fromName: string;
  toName: string;
  departureAt: string;
  arrivalAt: string;
  fromTz: string;
  toTz: string;
}

const KEY = 'traintix.booking';

export function saveSelection(s: BookingSelection) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function loadSelection(): BookingSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BookingSelection) : null;
  } catch {
    return null;
  }
}

export function clearSelection() {
  sessionStorage.removeItem(KEY);
}
