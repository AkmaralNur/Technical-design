export type SeatClass = 'ECONOMY' | 'BUSINESS';
export type Role = 'PASSENGER' | 'ADMIN';

export interface Money {
  amount: string;
  currency: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  city: string | null;
  timezone: string;
  isActive?: boolean;
}

export interface SearchItem {
  tripId: number;
  trainNumber: string;
  trainName: string | null;
  scheduleChanged: boolean;
  from: { stationId: number; name: string; stopOrder: number; departureAt: string; timezone: string };
  to: { stationId: number; name: string; stopOrder: number; arrivalAt: string; timezone: string };
  durationMinutes: number;
  minPrice: Money | null;
  classes: { seatClass: SeatClass; price: Money; freeSeats: number }[];
  freeSeats: number;
  hasSeats: boolean;
}

export interface TripStop {
  stopOrder: number;
  stationId: number;
  name: string;
  code: string;
  timezone: string;
  arrivalAt: string | null;
  departureAt: string | null;
}

export interface TripDetails {
  tripId: number;
  trainNumber: string;
  trainName: string | null;
  routeName: string;
  date: string;
  status: 'SCHEDULED' | 'CANCELLED';
  scheduleChanged: boolean;
  cancelReason: string | null;
  stops: TripStop[];
  selected: null | {
    from: number;
    to: number;
    departed: boolean;
    durationMinutes: number | null;
    prices: { seatClass: SeatClass; amount: string; currency: string }[];
  };
}

export interface SeatInfo {
  seatId: number;
  label: string;
  row: number;
  letter: string;
  available: boolean;
}

export interface CarriageMapData {
  carriageNo: number;
  seatClass: SeatClass;
  price: Money | null;
  rowsCount: number;
  layout: string;
  freeSeats: number;
  seats: SeatInfo[];
}

export interface SeatMap {
  tripId: number;
  from: number;
  to: number;
  tripStatus: 'SCHEDULED' | 'CANCELLED';
  carriages: CarriageMapData[];
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  status: 'CONFIRMED' | 'CANCELLED';
  displayStatus: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  passengerName: string;
  trainNumber: string;
  tripId: number;
  date: string;
  from: { name: string; stopOrder: number; departureAt: string; timezone: string };
  to: { name: string; stopOrder: number; arrivalAt: string; timezone: string };
  seat: { seatId: number; carriageNo: number; label: string; seatClass: SeatClass };
  price: Money;
  canCancel: boolean;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: Role | null;
  trip: { status: 'SCHEDULED' | 'CANCELLED'; cancelReason: string | null; scheduleChanged: boolean };
  userEmail?: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface BookTicketDto {
  tripId: number;
  seatId: number;
  fromStopOrder: number;
  toStopOrder: number;
  expectedPrice?: string;
}
