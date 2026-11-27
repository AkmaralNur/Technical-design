import { Link } from 'react-router-dom';
import type { Ticket } from '../api/types';
import { fmtDate, fmtMoney, fmtTime, SEAT_CLASS_RU } from '../utils/format';
import { Badge, StatusBadge } from './ui';

/** Билет кратко — для списка «Мои билеты» */
export function TicketCard({ t }: { t: Ticket }) {
  return (
    <Link to={`/tickets/${t.id}`} className="card block p-4 transition hover:border-blue-300 hover:shadow-md sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-500">{t.ticketNumber}</span>
          {t.trip.scheduleChanged && t.status === 'CONFIRMED' && <Badge color="amber">Расписание изменено</Badge>}
        </div>
        <StatusBadge status={t.displayStatus} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <div className="text-xs text-slate-500">{fmtDate(t.from.departureAt, t.from.timezone)}</div>
          <div className="text-lg font-bold">
            {t.from.name} <span className="text-slate-400">→</span> {t.to.name}
          </div>
          <div className="text-sm tabular-nums text-slate-600">
            {fmtTime(t.from.departureAt, t.from.timezone)} – {fmtTime(t.to.arrivalAt, t.to.timezone)}
          </div>
        </div>
        <div className="ml-auto text-right text-sm">
          <div className="font-semibold">
            Поезд {t.trainNumber} · вагон {t.seat.carriageNo} · место {t.seat.label}
          </div>
          <div className="text-slate-500">
            {SEAT_CLASS_RU[t.seat.seatClass]} · {fmtMoney(t.price)}
          </div>
        </div>
      </div>
    </Link>
  );
}
