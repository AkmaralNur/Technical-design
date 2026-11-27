import { Link } from 'react-router-dom';
import type { SearchItem } from '../api/types';
import { fmtDuration, fmtMoney, fmtTime, SEAT_CLASS_RU, seatsWord } from '../utils/format';
import { Badge } from './ui';

/** Поезд, время, длительность, цена по классам, есть ли места */
export function TripCard({ item }: { item: SearchItem }) {
  const link = `/trips/${item.tripId}?from=${item.from.stopOrder}&to=${item.to.stopOrder}`;
  return (
    <article className="card overflow-hidden transition hover:shadow-md">
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_220px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-600 px-2 py-0.5 text-sm font-bold text-white">{item.trainNumber}</span>
            {item.trainName && <span className="text-sm text-slate-500">{item.trainName}</span>}
            {item.scheduleChanged && <Badge color="amber">Расписание изменено</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-2xl font-bold tabular-nums">{fmtTime(item.from.departureAt, item.from.timezone)}</div>
              <div className="text-sm text-slate-600">{item.from.name}</div>
            </div>
            <div className="flex flex-1 flex-col items-center px-2">
              <span className="text-xs text-slate-500">{fmtDuration(item.durationMinutes)}</span>
              <div className="relative my-1 h-0.5 w-full bg-slate-300">
                <span className="absolute -top-1 left-0 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span className="absolute -top-1 right-0 h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white" />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">{fmtTime(item.to.arrivalAt, item.to.timezone)}</div>
              <div className="text-sm text-slate-600">{item.to.name}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.classes.map((c) => (
              <div key={c.seatClass} className={`rounded-lg border px-3 py-1.5 text-sm ${c.freeSeats ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100 text-slate-400'}`}>
                <span className="font-semibold">{SEAT_CLASS_RU[c.seatClass]}</span> · {fmtMoney(c.price)} ·{' '}
                {c.freeSeats ? <span className="text-emerald-700">{seatsWord(c.freeSeats)}</span> : 'нет мест'}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 md:flex-col md:items-end md:justify-center md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="md:text-right">
            <div className="text-xs text-slate-500">от</div>
            <div className="text-2xl font-extrabold text-blue-700">{fmtMoney(item.minPrice)}</div>
          </div>
          {item.hasSeats ? (
            <Link to={link} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Выбрать место
            </Link>
          ) : (
            <span className="rounded-lg bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-400">Нет мест</span>
          )}
        </div>
      </div>
    </article>
  );
}
