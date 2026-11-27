import { http } from './client';
import type { BookTicketDto, Paged, SearchItem, SeatMap, Station, Ticket, TripDetails, User } from './types';

// ---------- аккаунт
export const getMe = () => http.get<User>('/auth/me').then((r) => r.data);
export const login = (b: { email: string; password: string }) => http.post<User>('/auth/login', b).then((r) => r.data);
export const register = (b: { name: string; email: string; password: string }) => http.post<User>('/auth/register', b).then((r) => r.data);
export const logout = () => http.post('/auth/logout');

// ---------- поиск и рейсы
export const getStations = () => http.get<Station[]>('/stations').then((r) => r.data);

export type SearchParams = Record<string, string | undefined>;
export const searchTrips = (p: SearchParams) => http.get<{ items: SearchItem[] }>('/trips/search', { params: p }).then((r) => r.data);
export const getTrip = (id: number, from?: number, to?: number) =>
  http.get<TripDetails>(`/trips/${id}`, { params: { from, to } }).then((r) => r.data);
export const getSeatMap = (id: number, from: number, to: number) =>
  http.get<SeatMap>(`/trips/${id}/seats`, { params: { from, to } }).then((r) => r.data);

// ---------- билеты
export const bookTicket = (b: BookTicketDto) => http.post<Ticket>('/tickets', b).then((r) => r.data);
export const getMyTickets = (p: SearchParams) => http.get<Paged<Ticket>>('/tickets', { params: p }).then((r) => r.data);
export const getTicket = (id: number) => http.get<Ticket>(`/tickets/${id}`).then((r) => r.data);
export const cancelTicket = (id: number) => http.post<Ticket>(`/tickets/${id}/cancel`).then((r) => r.data);
export const ticketPdfUrl = (id: number) => `/api/tickets/${id}/pdf`; // обычная ссылка <a href download>

// ---------- админ
export const admin = {
  stats: () => http.get('/admin/stats').then((r) => r.data),
  audit: () => http.get('/admin/audit', { params: { limit: 15 } }).then((r) => r.data),

  stations: () => http.get<Station[]>('/admin/stations').then((r) => r.data),
  createStation: (b: unknown) => http.post('/admin/stations', b).then((r) => r.data),
  updateStation: (id: number, b: unknown) => http.patch(`/admin/stations/${id}`, b).then((r) => r.data),

  trains: () => http.get('/admin/trains').then((r) => r.data),
  createTrain: (b: unknown) => http.post('/admin/trains', b).then((r) => r.data),
  updateTrain: (id: number, b: unknown) => http.patch(`/admin/trains/${id}`, b).then((r) => r.data),
  carriages: (trainId: number) => http.get(`/admin/trains/${trainId}/carriages`).then((r) => r.data),
  addCarriage: (trainId: number, b: unknown) => http.post(`/admin/trains/${trainId}/carriages`, b).then((r) => r.data),
  updateCarriage: (id: number, b: unknown) => http.patch(`/admin/carriages/${id}`, b).then((r) => r.data),
  updateSeat: (id: number, b: unknown) => http.patch(`/admin/seats/${id}`, b).then((r) => r.data),

  routes: () => http.get('/admin/routes').then((r) => r.data),
  route: (id: number) => http.get(`/admin/routes/${id}`).then((r) => r.data),
  createRoute: (b: unknown) => http.post('/admin/routes', b).then((r) => r.data),
  updateRoute: (id: number, b: unknown) => http.patch(`/admin/routes/${id}`, b).then((r) => r.data),
  updateStops: (id: number, b: unknown) => http.put(`/admin/routes/${id}/stops`, b).then((r) => r.data),
  setFares: (id: number, b: unknown) => http.put(`/admin/routes/${id}/fares`, b).then((r) => r.data),

  trips: (p: SearchParams) => http.get('/admin/trips', { params: p }).then((r) => r.data),
  createTrips: (b: unknown) => http.post('/admin/trips', b).then((r) => r.data),
  updateSchedule: (id: number, b: unknown) => http.patch(`/admin/trips/${id}/schedule`, b).then((r) => r.data),
  cancelTrip: (id: number, b: unknown) => http.post(`/admin/trips/${id}/cancel`, b).then((r) => r.data),

  tickets: (p: SearchParams) => http.get<Paged<Ticket>>('/admin/tickets', { params: p }).then((r) => r.data),
  exportUrl: (p: SearchParams) => `/api/admin/tickets/export?${new URLSearchParams(clean(p)).toString()}`,
};

export function clean(p: SearchParams): Record<string, string> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;
}
