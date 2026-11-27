import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { db } from '../src/db/client';
import * as routesService from '../src/modules/routes/routes.service';
import * as trainsService from '../src/modules/trains/trains.service';
import * as tripsService from '../src/modules/trips/trips.service';
import { localIsoDate } from '../src/utils/format';

// Раздел 19.3 — API-тесты и сценарии A–G из раздела 11.5 на тестовой базе

const app = createApp();
let tripId: number; // рейс завтра
let tripNextDay: number; // рейс послезавтра
let seat12A: number;
let date: string;
let cookieA: string[];
let cookieB: string[];
let cookieAdmin: string[];
const st: Record<string, number> = {};

function addDays(iso: string, d: number) {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}

async function loginAs(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'] as unknown as string[];
}

const book = (cookie: string[], from: number, to: number, trip = tripId, seat = seat12A) =>
  request(app).post('/api/tickets').set('Cookie', cookie).send({ tripId: trip, seatId: seat, fromStopOrder: from, toStopOrder: to });

beforeAll(async () => {
  const hash = await bcrypt.hash('secret123', 4);
  const admin = await db.user.create({ data: { name: 'Admin', email: 'admin@test.local', passwordHash: hash, role: 'ADMIN' } });
  await db.user.create({ data: { name: 'Anna', email: 'anna@test.local', passwordHash: hash } });
  await db.user.create({ data: { name: 'Boris', email: 'boris@test.local', passwordHash: hash } });
  for (const [code, name] of [['PRG', 'Prague'], ['BRN', 'Brno'], ['VIE', 'Vienna']]) {
    st[code] = Number((await db.station.create({ data: { code, name, timezone: 'Europe/Prague' } })).id);
  }
  const A = Number(admin.id);
  const train = await trainsService.create(A, { number: 'T101', name: null });
  await trainsService.addCarriage(A, Number(train.id), { carriageNo: 1, seatClass: 'ECONOMY', rowsCount: 15, layout: 'AB_CD' });
  const route = await routesService.create(A, {
    trainId: Number(train.id), name: 'Prague – Vienna', departureTime: '07:00', timezone: 'Europe/Prague',
    stops: [
      { stationId: st.PRG, arrivalOffsetMin: null, departureOffsetMin: 0 },
      { stationId: st.BRN, arrivalOffsetMin: 150, departureOffsetMin: 155 },
      { stationId: st.VIE, arrivalOffsetMin: 240, departureOffsetMin: null },
    ],
  });
  await routesService.setFares(A, route.id, {
    currency: 'EUR',
    fares: [
      { from: 0, to: 1, seatClass: 'ECONOMY', price: '19.00' },
      { from: 1, to: 2, seatClass: 'ECONOMY', price: '15.00' },
      { from: 0, to: 2, seatClass: 'ECONOMY', price: '29.00' },
    ],
  });
  date = addDays(localIsoDate(new Date(), 'Europe/Prague'), 1);
  await tripsService.createTrips(A, { routeId: route.id, dateFrom: date, dateTo: addDays(date, 1), weekdays: [1, 2, 3, 4, 5, 6, 7] });
  const trips = await db.trip.findMany({ orderBy: { serviceDate: 'asc' } });
  tripId = Number(trips[0].id);
  tripNextDay = Number(trips[1].id);
  seat12A = Number((await db.seat.findFirstOrThrow({ where: { seatLabel: '12A' } })).id);

  cookieA = await loginAs('anna@test.local', 'secret123');
  cookieB = await loginAs('boris@test.local', 'secret123');
  cookieAdmin = await loginAs('admin@test.local', 'secret123');
});

afterAll(async () => {
  await db.$disconnect();
});

describe('Аутентификация', () => {
  it('регистрация → 201 и cookie; повтор → 409 EMAIL_TAKEN', async () => {
    const body = { name: 'New User', email: 'New@Test.local', password: 'secret123' };
    const r1 = await request(app).post('/api/auth/register').send(body);
    expect(r1.status).toBe(201);
    expect(r1.body.email).toBe('new@test.local');
    expect(r1.body.role).toBe('PASSENGER');
    expect(r1.headers['set-cookie']).toBeDefined();
    const r2 = await request(app).post('/api/auth/register').send(body);
    expect(r2.body.error.code).toBe('EMAIL_TAKEN');
  });
  it('слабый пароль → 400 VALIDATION_ERROR', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'x@y.z', password: '12345678' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('неверный пароль → 401 INVALID_CREDENTIALS', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'anna@test.local', password: 'wrong1234' });
    expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
  });
  it('без входа бронировать нельзя → 401', async () => {
    const r = await request(app).post('/api/tickets').send({ tripId, seatId: seat12A, fromStopOrder: 0, toStopOrder: 1 });
    expect(r.status).toBe(401);
  });
  it('пассажир не может зайти в админку → 403', async () => {
    const r = await request(app).get('/api/admin/stats').set('Cookie', cookieA);
    expect(r.status).toBe(403);
  });
});

describe('Поиск', () => {
  it('A — промежуточная станция: Prague → Brno находит T101', async () => {
    const r = await request(app).get('/api/trips/search').query({ from: st.PRG, to: st.BRN, date });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].trainNumber).toBe('T101');
    expect(r.body.items[0].minPrice).toEqual({ amount: '19.00', currency: 'EUR' });
    expect(r.body.items[0].durationMinutes).toBe(150);
  });
  it('F — неверное направление: Vienna → Prague не находит', async () => {
    const r = await request(app).get('/api/trips/search').query({ from: st.VIE, to: st.PRG, date });
    expect(r.body.items).toHaveLength(0);
  });
  it('одинаковые станции → 400 SAME_STATIONS', async () => {
    const r = await request(app).get('/api/trips/search').query({ from: st.PRG, to: st.PRG, date });
    expect(r.body.error.code).toBe('SAME_STATIONS');
  });
});

describe('Бронирование — сценарии 11.5', () => {
  let ticketA: number;

  it('A покупает 12A Prague → Brno', async () => {
    const r = await book(cookieA, 0, 1);
    expect(r.status).toBe(201);
    expect(r.body.ticketNumber).toMatch(/^TTX-/);
    expect(r.body.price.amount).toBe('19.00');
    ticketA = r.body.id;
  });
  it('B — то же место Brno → Vienna можно', async () => {
    expect((await book(cookieB, 1, 2)).status).toBe(201);
  });
  it('C — Prague → Vienna нельзя: 409 SEAT_UNAVAILABLE', async () => {
    const r = await book(cookieB, 0, 2);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SEAT_UNAVAILABLE');
  });
  it('карта мест показывает 12A занятым на [0,2) и [0,1)', async () => {
    const r = await request(app).get(`/api/trips/${tripId}/seats`).query({ from: 0, to: 2 });
    const seat = r.body.carriages[0].seats.find((s: { label: string }) => s.label === '12A');
    expect(seat.available).toBe(false);
  });
  it('чужой билет → 404', async () => {
    expect((await request(app).get(`/api/tickets/${ticketA}`).set('Cookie', cookieB)).status).toBe(404);
    expect((await request(app).post(`/api/tickets/${ticketA}/cancel`).set('Cookie', cookieB)).status).toBe(404);
  });
  it('D — после отмены A и B место свободно на Prague → Vienna', async () => {
    const c1 = await request(app).post(`/api/tickets/${ticketA}/cancel`).set('Cookie', cookieA);
    expect(c1.body.status).toBe('CANCELLED');
    const again = await request(app).post(`/api/tickets/${ticketA}/cancel`).set('Cookie', cookieA);
    expect(again.body.error.code).toBe('ALREADY_CANCELLED');
    const mine = await request(app).get('/api/tickets').query({ status: 'upcoming' }).set('Cookie', cookieB);
    await request(app).post(`/api/tickets/${mine.body.items[0].id}/cancel`).set('Cookie', cookieB);
    expect((await book(cookieA, 0, 2)).status).toBe(201);
  });
  it('G — другой рейс (на день позже) не конфликтует', async () => {
    expect((await book(cookieB, 0, 2, tripNextDay)).status).toBe(201);
  });
  it('E — 10 одновременных броней одного места: ровно одна успешна', async () => {
    const seat = Number((await db.seat.findFirstOrThrow({ where: { seatLabel: '5B' } })).id);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => book(i % 2 ? cookieA : cookieB, 0, 1, tripId, seat)));
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
  });
  it('цена изменилась → 409 PRICE_CHANGED', async () => {
    const seat = Number((await db.seat.findFirstOrThrow({ where: { seatLabel: '7C' } })).id);
    const r = await request(app).post('/api/tickets').set('Cookie', cookieA).send({ tripId, seatId: seat, fromStopOrder: 0, toStopOrder: 1, expectedPrice: '1.00' });
    expect(r.body.error.code).toBe('PRICE_CHANGED');
    expect(r.body.error.details.newPrice.amount).toBe('19.00');
  });
  it('неверное направление при брони → 400 INVALID_JOURNEY', async () => {
    const r = await book(cookieA, 2, 0);
    expect(r.body.error.code).toBe('INVALID_JOURNEY');
  });
  it('PDF своего билета скачивается', async () => {
    const mine = await request(app).get('/api/tickets').set('Cookie', cookieA);
    const r = await request(app).get(`/api/tickets/${mine.body.items[0].id}/pdf`).set('Cookie', cookieA);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
  });
  it('письма о брони поставлены в очередь', async () => {
    expect(await db.emailOutbox.count({ where: { type: 'BOOKING_CONFIRMED' } })).toBeGreaterThan(0);
  });
});

describe('Администратор', () => {
  it('выключить место с проданными билетами нельзя → 409 HAS_CONFIRMED_TICKETS', async () => {
    const r = await request(app).patch(`/api/admin/seats/${seat12A}`).set('Cookie', cookieAdmin).send({ isActive: false });
    expect(r.body.error.code).toBe('HAS_CONFIRMED_TICKETS');
  });
  it('отмена рейса без подтверждения → 409, с подтверждением → все билеты отменены', async () => {
    const r1 = await request(app).post(`/api/admin/trips/${tripNextDay}/cancel`).set('Cookie', cookieAdmin).send({ reason: 'Ремонт путей' });
    expect(r1.body.error.code).toBe('HAS_CONFIRMED_TICKETS');
    const r2 = await request(app).post(`/api/admin/trips/${tripNextDay}/cancel`).set('Cookie', cookieAdmin).send({ reason: 'Ремонт путей', confirm: true });
    expect(r2.body.ticketsCancelled).toBe(1);
    expect(await db.ticket.count({ where: { tripId: tripNextDay, status: 'CONFIRMED' } })).toBe(0);
    expect(await db.emailOutbox.count({ where: { type: 'TRIP_CANCELLED' } })).toBe(1);
  });
  it('CSV выгрузка', async () => {
    const r = await request(app).get('/api/admin/tickets/export').set('Cookie', cookieAdmin);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain('Номер билета');
  });
});
