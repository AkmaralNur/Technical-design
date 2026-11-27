import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { admin } from '../../api';
import { ErrorMessage, PageSpinner, PageTitle } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';

interface Stats {
  stations: number;
  trains: number;
  routes: number;
  upcomingTrips: number;
  ticketsConfirmed: number;
  ticketsCancelled: number;
  revenue: string;
  passengers: number;
  emails: Record<string, number>;
}

const ACTIONS_RU: Record<string, string> = {
  TICKET_BOOKED: 'Бронь билета',
  TICKET_CANCELLED: 'Отмена билета',
  TRIP_CANCELLED: 'Отмена рейса',
  TRIP_SCHEDULE_CHANGED: 'Изменение расписания',
  TRIPS_CREATED: 'Созданы рейсы',
  ROUTE_CREATED: 'Создан маршрут',
  ROUTE_UPDATED: 'Изменён маршрут',
  FARES_UPDATED: 'Изменены цены',
  STATION_CREATED: 'Новая станция',
  STATION_UPDATED: 'Изменена станция',
  TRAIN_CREATED: 'Новый поезд',
  TRAIN_UPDATED: 'Изменён поезд',
  CARRIAGE_ADDED: 'Добавлен вагон',
  CARRIAGE_UPDATED: 'Изменён вагон',
  SEAT_UPDATED: 'Изменено место',
  USER_REGISTERED: 'Регистрация',
};

export function AdminHome() {
  const stats = useQuery<Stats>({ queryKey: ['admin', 'stats'], queryFn: admin.stats });
  const audit = useQuery<{ id: number; action: string; entity: string; entityId: number; user: string | null; createdAt: string }[]>({
    queryKey: ['admin', 'audit'],
    queryFn: admin.audit,
  });

  if (stats.isLoading) return <PageSpinner />;
  if (stats.isError) return <ErrorMessage error={stats.error} />;
  const s = stats.data!;

  const tiles: [string, string | number, string, string][] = [
    ['Подтверждённых билетов', s.ticketsConfirmed, '/admin/bookings?status=CONFIRMED', '🎫'],
    ['Выручка, EUR', s.revenue, '/admin/bookings', '💶'],
    ['Предстоящих рейсов', s.upcomingTrips, '/admin/trips', '🚆'],
    ['Отменённых билетов', s.ticketsCancelled, '/admin/bookings?status=CANCELLED', '↩️'],
    ['Пассажиров', s.passengers, '/admin/bookings', '👥'],
    ['Станций', s.stations, '/admin/stations', '📍'],
    ['Поездов', s.trains, '/admin/trains', '🚃'],
    ['Маршрутов', s.routes, '/admin/routes', '🗺️'],
  ];

  return (
    <>
      <PageTitle title="Панель администратора" subtitle="Станции, поезда, маршруты, рейсы и бронирования" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, to, icon]) => (
          <Link key={label} to={to} className="card p-4 transition hover:border-blue-300 hover:shadow-md">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Письма: отправлено {s.emails.SENT ?? 0}, в очереди {s.emails.PENDING ?? 0}, с ошибкой {s.emails.FAILED ?? 0}
      </p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Журнал действий</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Когда</th>
              <th>Действие</th>
              <th>Объект</th>
              <th>Кто</th>
            </tr>
          </thead>
          <tbody>
            {audit.data?.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-slate-500">{fmtDateTime(a.createdAt)}</td>
                <td className="font-medium">{ACTIONS_RU[a.action] ?? a.action}</td>
                <td className="text-slate-500">
                  {a.entity} #{a.entityId}
                </td>
                <td className="text-slate-500">{a.user ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
