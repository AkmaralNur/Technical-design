import { NavLink, Outlet } from 'react-router-dom';
import type { ApiError } from '../../api/types';
import { Modal, Button } from '../../components/ui';

const LINKS = [
  ['/admin', 'Обзор'],
  ['/admin/stations', 'Станции'],
  ['/admin/trains', 'Поезда'],
  ['/admin/routes', 'Маршруты и цены'],
  ['/admin/trips', 'Рейсы'],
  ['/admin/bookings', 'Бронирования'],
];

export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {LINKS.map(([to, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin'}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

/** Окно со списком проданных билетов при ошибке HAS_CONFIRMED_TICKETS */
export function TicketsConflictModal({ error, onClose }: { error: ApiError; onClose: () => void }) {
  const d = error.details as { ticketsCount?: number; tickets?: { id: number; ticketNumber: string; carriageNo: number; seatLabel: string }[] } | null;
  return (
    <Modal title="Изменение невозможно" onClose={onClose} footer={<Button onClick={onClose}>Понятно</Button>}>
      <p className="text-sm text-slate-700">{error.message}</p>
      {d?.tickets && (
        <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Билет</th>
                <th>Вагон</th>
                <th>Место</th>
              </tr>
            </thead>
            <tbody>
              {d.tickets.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono">{t.ticketNumber}</td>
                  <td>{t.carriageNo}</td>
                  <td>{t.seatLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
