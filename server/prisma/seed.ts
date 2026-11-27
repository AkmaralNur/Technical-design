/**
 * Начальные данные TrainTix (раздел 22.3 технического дизайна).
 * ВНИМАНИЕ: очищает все таблицы и заполняет заново.
 * Запуск: npm run seed
 */
import bcrypt from 'bcryptjs';
import { config } from '../src/config';
import { db } from '../src/db/client';
import * as routesService from '../src/modules/routes/routes.service';
import * as ticketsService from '../src/modules/tickets/tickets.service';
import * as trainsService from '../src/modules/trains/trains.service';
import * as tripsService from '../src/modules/trips/trips.service';
import { localIsoDate } from '../src/utils/format';

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Цены для всех пар остановок одного класса */
function fares(seatClass: 'ECONOMY' | 'BUSINESS', prices: Record<string, string>) {
  return Object.entries(prices).map(([pair, price]) => {
    const [from, to] = pair.split('-').map(Number);
    return { from, to, seatClass, price };
  });
}

async function main() {
  console.log('Очистка таблиц…');
  await db.$executeRawUnsafe(`
    TRUNCATE email_outbox, audit_log, tickets, trip_stops, trips, fares, route_stops, routes,
             seats, carriages, trains, stations, users RESTART IDENTITY CASCADE`);

  // ---- пользователи
  const admin = await db.user.create({
    data: { name: 'Администратор', email: 'admin@traintix.local', passwordHash: await bcrypt.hash(config.seedAdminPassword, 12), role: 'ADMIN' },
  });
  const anna = await db.user.create({
    data: { name: 'Anna Novak', email: 'anna@example.com', passwordHash: await bcrypt.hash('secret123', 12) },
  });
  const petr = await db.user.create({
    data: { name: 'Petr Svoboda', email: 'petr@example.com', passwordHash: await bcrypt.hash('secret123', 12) },
  });
  const A = Number(admin.id);

  // ---- станции
  const stationData = [
    { code: 'PRG', name: 'Prague', city: 'Prague', timezone: 'Europe/Prague' },
    { code: 'BRN', name: 'Brno', city: 'Brno', timezone: 'Europe/Prague' },
    { code: 'VIE', name: 'Vienna', city: 'Vienna', timezone: 'Europe/Vienna' },
    { code: 'BTS', name: 'Bratislava', city: 'Bratislava', timezone: 'Europe/Bratislava' },
    { code: 'OST', name: 'Ostrava', city: 'Ostrava', timezone: 'Europe/Prague' },
    { code: 'PCE', name: 'Pardubice', city: 'Pardubice', timezone: 'Europe/Prague' },
  ];
  const st: Record<string, number> = {};
  for (const s of stationData) st[s.code] = Number((await db.station.create({ data: s })).id);

  // ---- поезда и вагоны (места создаются автоматически)
  const t101 = await trainsService.create(A, { number: 'T101', name: 'Moravia Express' });
  await trainsService.addCarriage(A, Number(t101.id), { carriageNo: 1, seatClass: 'BUSINESS', rowsCount: 8, layout: 'A_BC' });
  await trainsService.addCarriage(A, Number(t101.id), { carriageNo: 2, seatClass: 'ECONOMY', rowsCount: 15, layout: 'AB_CD' });
  await trainsService.addCarriage(A, Number(t101.id), { carriageNo: 3, seatClass: 'ECONOMY', rowsCount: 15, layout: 'AB_CD' });

  const t205 = await trainsService.create(A, { number: 'T205', name: 'Danube Link' });
  await trainsService.addCarriage(A, Number(t205.id), { carriageNo: 1, seatClass: 'BUSINESS', rowsCount: 6, layout: 'A_BC' });
  await trainsService.addCarriage(A, Number(t205.id), { carriageNo: 2, seatClass: 'ECONOMY', rowsCount: 12, layout: 'AB_CD' });

  const t310 = await trainsService.create(A, { number: 'T310', name: 'Vltava Evening' });
  await trainsService.addCarriage(A, Number(t310.id), { carriageNo: 1, seatClass: 'BUSINESS', rowsCount: 6, layout: 'A_BC' });
  await trainsService.addCarriage(A, Number(t310.id), { carriageNo: 2, seatClass: 'ECONOMY', rowsCount: 14, layout: 'AB_CD' });

  // ---- маршруты + цены
  const r1 = await routesService.create(A, {
    trainId: Number(t101.id), name: 'Prague – Vienna (утренний)', departureTime: '07:00', timezone: 'Europe/Prague',
    stops: [
      { stationId: st.PRG, arrivalOffsetMin: null, departureOffsetMin: 0 },
      { stationId: st.BRN, arrivalOffsetMin: 150, departureOffsetMin: 155 },
      { stationId: st.VIE, arrivalOffsetMin: 240, departureOffsetMin: null },
    ],
  });
  await routesService.setFares(A, r1.id, {
    currency: 'EUR',
    fares: [
      ...fares('ECONOMY', { '0-1': '19.00', '1-2': '15.00', '0-2': '29.00' }),
      ...fares('BUSINESS', { '0-1': '35.00', '1-2': '28.00', '0-2': '55.00' }),
    ],
  });

  const r2 = await routesService.create(A, {
    trainId: Number(t205.id), name: 'Ostrava – Bratislava (дневной)', departureTime: '13:15', timezone: 'Europe/Prague',
    stops: [
      { stationId: st.OST, arrivalOffsetMin: null, departureOffsetMin: 0 },
      { stationId: st.BRN, arrivalOffsetMin: 140, departureOffsetMin: 145 },
      { stationId: st.BTS, arrivalOffsetMin: 230, departureOffsetMin: null },
    ],
  });
  await routesService.setFares(A, r2.id, {
    currency: 'EUR',
    fares: [
      ...fares('ECONOMY', { '0-1': '21.00', '1-2': '14.00', '0-2': '32.00' }),
      ...fares('BUSINESS', { '0-1': '38.00', '1-2': '26.00', '0-2': '58.00' }),
    ],
  });

  // обратное направление: Vienna → Brno → Pardubice → Prague
  const r3 = await routesService.create(A, {
    trainId: Number(t310.id), name: 'Vienna – Prague (вечерний)', departureTime: '16:30', timezone: 'Europe/Vienna',
    stops: [
      { stationId: st.VIE, arrivalOffsetMin: null, departureOffsetMin: 0 },
      { stationId: st.BRN, arrivalOffsetMin: 85, departureOffsetMin: 90 },
      { stationId: st.PCE, arrivalOffsetMin: 190, departureOffsetMin: 193 },
      { stationId: st.PRG, arrivalOffsetMin: 250, departureOffsetMin: null },
    ],
  });
  await routesService.setFares(A, r3.id, {
    currency: 'EUR',
    fares: [
      ...fares('ECONOMY', { '0-1': '15.00', '0-2': '24.00', '0-3': '29.00', '1-2': '12.00', '1-3': '19.00', '2-3': '8.00' }),
      ...fares('BUSINESS', { '0-1': '28.00', '0-2': '44.00', '0-3': '55.00', '1-2': '22.00', '1-3': '35.00', '2-3': '15.00' }),
    ],
  });

  // ---- рейсы на 14 дней вперёд
  const today = localIsoDate(new Date(), 'Europe/Prague');
  for (const r of [r1, r2, r3]) {
    const res = await tripsService.createTrips(A, { routeId: r.id, dateFrom: today, dateTo: addDays(today, 13), weekdays: [1, 2, 3, 4, 5, 6, 7] });
    console.log(`  маршрут «${r.name}»: создано рейсов ${res.created}`);
  }

  // ---- примеры билетов (сценарии из раздела 11.5)
  const tomorrow = addDays(today, 1);
  const trip101 = await db.trip.findFirstOrThrow({ where: { routeId: r1.id, serviceDate: new Date(`${tomorrow}T00:00:00Z`) } });
  const seat12A = await db.seat.findFirstOrThrow({ where: { trainId: t101.id, carriageNo: 3, seatLabel: '12A' } });
  const seat3C = await db.seat.findFirstOrThrow({ where: { trainId: t101.id, carriageNo: 2, seatLabel: '3C' } });

  // Anna: 12A Prague → Brno
  await ticketsService.bookTicket(Number(anna.id), { tripId: Number(trip101.id), seatId: Number(seat12A.id), fromStopOrder: 0, toStopOrder: 1 });
  // Petr: то же место 12A Brno → Vienna — участки не пересекаются (сценарий B)
  await ticketsService.bookTicket(Number(petr.id), { tripId: Number(trip101.id), seatId: Number(seat12A.id), fromStopOrder: 1, toStopOrder: 2 });
  // Anna: ещё один билет и его отмена
  const t = await ticketsService.bookTicket(Number(anna.id), { tripId: Number(trip101.id), seatId: Number(seat3C.id), fromStopOrder: 0, toStopOrder: 2 });
  await ticketsService.cancelTicket(Number(anna.id), t.id);

  const trip205 = await db.trip.findFirstOrThrow({ where: { routeId: r2.id, serviceDate: new Date(`${addDays(today, 3)}T00:00:00Z`) } });
  const seatB = await db.seat.findFirstOrThrow({ where: { trainId: t205.id, carriageNo: 1, seatLabel: '2B' } });
  await ticketsService.bookTicket(Number(anna.id), { tripId: Number(trip205.id), seatId: Number(seatB.id), fromStopOrder: 0, toStopOrder: 2 });

  // письма для тестовых билетов считаем уже отправленными
  await db.emailOutbox.updateMany({ data: { status: 'SENT', sentAt: new Date() } });

  console.log('\n✔ Тестовые данные созданы');
  console.log(`  Админ:    admin@traintix.local / ${config.seedAdminPassword}`);
  console.log('  Пассажир: anna@example.com / secret123');
  console.log('  Пассажир: petr@example.com / secret123');
}

main()
  .catch((e) => {
    console.error('✘ Ошибка seed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
