import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { admin, clean } from '../../api';
import { errorText } from '../../api/client';
import type { ApiError, TripStop } from '../../api/types';
import { Alert, Badge, Button, ErrorMessage, Field, Modal, PageSpinner, PageTitle, Pagination } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { addDaysIso, fmtLongDate, fmtTime, todayIso } from '../../utils/format';

interface TripRow {
  tripId: number;
  routeId: number;
  routeName: string;
  trainNumber: string;
  date: string;
  status: 'SCHEDULED' | 'CANCELLED';
  scheduleChanged: boolean;
  cancelReason: string | null;
  soldTickets: number;
  stops: TripStop[];
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Изменение времени рейса: сдвиг на N минут начиная с выбранной остановки (раздел 10.8) */
function ScheduleModal({ trip, onClose }: { trip: TripRow; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fromStop, setFromStop] = useState(0);
  const [shift, setShift] = useState(15);
  const [warning, setWarning] = useState<string | null>(null);

  const shifted = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + shift * 60000).toISOString() : null);
  const changes = trip.stops
    .filter((s) => s.stopOrder >= fromStop)
    .map((s) => ({
      stopOrder: s.stopOrder,
      arrivalAt: s.stopOrder === fromStop ? undefined : shifted(s.arrivalAt),
      departureAt: shifted(s.departureAt),
    }));
  // если сдвигаем с первой остановки, прибытие у неё не меняется; с промежуточной — двигаем только отправление и дальше
  const save = useMutation({
    mutationFn: (confirm: boolean) => admin.updateSchedule(trip.tripId, { stops: changes, confirm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'trips'] });
      toast('Расписание изменено. Пассажиры получат письма.', 'success');
      onClose();
    },
    onError: (e: ApiError) => (e.code === 'HAS_CONFIRMED_TICKETS' ? setWarning(e.message) : toast(errorText(e), 'error')),
  });

  return (
    <Modal
      title={`Изменить время · ${trip.trainNumber}, ${fmtLongDate(trip.date)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          {warning ? (
            <Button variant="danger" loading={save.isPending} onClick={() => save.mutate(true)}>
              Подтвердить изменение
            </Button>
          ) : (
            <Button loading={save.isPending} disabled={!shift} onClick={() => save.mutate(false)}>
              Сохранить
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Начиная с остановки (отправление)">
          <select className="input" value={fromStop} onChange={(e) => setFromStop(Number(e.target.value))}>
            {trip.stops.slice(0, -1).map((s) => (
              <option key={s.stopOrder} value={s.stopOrder}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Сдвиг, минут" hint="Плюс — задержка, минус — раньше">
          <input type="number" className="input" value={shift} onChange={(e) => setShift(Number(e.target.value))} />
        </Field>
      </div>
      <table className="table mt-4">
        <thead>
          <tr>
            <th>Станция</th>
            <th>Было</th>
            <th>Станет</th>
          </tr>
        </thead>
        <tbody>
          {trip.stops.map((s) => {
            const ch = changes.find((c) => c.stopOrder === s.stopOrder);
            const newArr = ch && ch.arrivalAt !== undefined ? ch.arrivalAt : s.arrivalAt;
            const newDep = ch ? ch.departureAt : s.departureAt;
            const fmt = (a: string | null, d: string | null) => [a && `приб. ${fmtTime(a, s.timezone)}`, d && `отпр. ${fmtTime(d, s.timezone)}`].filter(Boolean).join(' / ');
            return (
              <tr key={s.stopOrder}>
                <td className="font-medium">{s.name}</td>
                <td className="text-slate-500">{fmt(s.arrivalAt, s.departureAt)}</td>
                <td className={ch ? 'font-semibold text-amber-700' : 'text-slate-500'}>{fmt(newArr, newDep)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {warning && (
        <div className="mt-4">
          <Alert kind="warning">{warning}</Alert>
        </div>
      )}
    </Modal>
  );
}

function CancelTripModal({ trip, onClose }: { trip: TripRow; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: (confirm: boolean) => admin.cancelTrip(trip.tripId, { reason, confirm }),
    onSuccess: (r: { ticketsCancelled: number }) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast(`Рейс отменён. Отменено билетов: ${r.ticketsCancelled}`, 'success');
      onClose();
    },
    onError: (e: ApiError) => (e.code === 'HAS_CONFIRMED_TICKETS' ? setWarning(e.message) : toast(errorText(e), 'error')),
  });
  return (
    <Modal
      title={`Отменить рейс ${trip.trainNumber}, ${fmtLongDate(trip.date)}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Назад
          </Button>
          <Button variant="danger" loading={cancel.isPending} disabled={reason.trim().length < 3} onClick={() => cancel.mutate(!!warning)}>
            {warning ? 'Да, отменить рейс и билеты' : 'Отменить рейс'}
          </Button>
        </>
      }
    >
      <Field label="Причина отмены (увидят пассажиры)">
        <input className="input" placeholder="Технические работы на путях" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="mt-3 text-sm text-slate-600">Продано билетов: <b>{trip.soldTickets}</b>. Все они будут отменены, пассажиры получат письмо.</p>
      {warning && (
        <div className="mt-3">
          <Alert kind="warning">{warning}</Alert>
        </div>
      )}
    </Modal>
  );
}

export function AdminTrips() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const routes = useQuery<{ id: number; name: string; trainNumber: string; missingFares: number; isActive: boolean }[]>({ queryKey: ['admin', 'routes'], queryFn: admin.routes });
  const filters = { dateFrom: todayIso(), ...Object.fromEntries(params.entries()), limit: '20' };
  const trips = useQuery<{ items: TripRow[]; page: number; limit: number; total: number }>({
    queryKey: ['admin', 'trips', filters],
    queryFn: () => admin.trips(clean(filters)),
    placeholderData: keepPreviousData,
  });

  const [form, setForm] = useState({ routeId: params.get('routeId') ?? '', dateFrom: todayIso(), dateTo: addDaysIso(todayIso(), 13), weekdays: [1, 2, 3, 4, 5, 6, 7] });
  const [schedule, setSchedule] = useState<TripRow | null>(null);
  const [cancelling, setCancelling] = useState<TripRow | null>(null);

  const create = useMutation({
    mutationFn: () => admin.createTrips({ ...form, routeId: Number(form.routeId) }),
    onSuccess: (r: { created: number; skipped: number }) => {
      toast(`Создано рейсов: ${r.created}, пропущено (уже были): ${r.skipped}`, 'success');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e: ApiError) => toast(e.code === 'FARES_MISSING' ? 'Сначала заполните все цены маршрута' : errorText(e), 'error'),
  });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageTitle title="Рейсы" subtitle="Рейс — поездка маршрута в конкретную дату. Точное время считается автоматически." />

      <div className="card mb-6 p-4">
        <h2 className="mb-3 font-semibold">Создать рейсы на даты</h2>
        <div className="grid items-end gap-3 md:grid-cols-[1fr_160px_160px]">
          <Field label="Маршрут">
            <select className="input" value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}>
              <option value="">— выберите —</option>
              {routes.data?.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.isActive}>
                  {r.trainNumber} · {r.name} {r.missingFares ? '(нет цен!)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="С даты">
            <input type="date" className="input" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
          </Field>
          <Field label="По дату">
            <input type="date" className="input" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="label mb-0">Дни недели:</span>
          {WEEKDAYS.map((d, i) => {
            const n = i + 1;
            const on = form.weekdays.includes(n);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((x) => x !== n) : [...form.weekdays, n].sort() })}
                className={`h-9 w-10 rounded-lg text-sm font-semibold ${on ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
              >
                {d}
              </button>
            );
          })}
          <Button className="ml-auto" loading={create.isPending} disabled={!form.routeId || !form.weekdays.length} onClick={() => create.mutate()}>
            Создать рейсы
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Маршрут">
          <select className="input" value={params.get('routeId') ?? ''} onChange={(e) => set('routeId', e.target.value)}>
            <option value="">Все</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.trainNumber} · {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата от">
          <input type="date" className="input" value={params.get('dateFrom') ?? todayIso()} onChange={(e) => set('dateFrom', e.target.value)} />
        </Field>
        <Field label="Дата до">
          <input type="date" className="input" value={params.get('dateTo') ?? ''} onChange={(e) => set('dateTo', e.target.value)} />
        </Field>
        <Field label="Статус">
          <select className="input" value={params.get('status') ?? ''} onChange={(e) => set('status', e.target.value)}>
            <option value="">Все</option>
            <option value="SCHEDULED">По расписанию</option>
            <option value="CANCELLED">Отменён</option>
          </select>
        </Field>
      </div>

      {trips.isLoading && <PageSpinner />}
      {trips.isError && <ErrorMessage error={trips.error} />}
      {trips.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Поезд</th>
                  <th>Маршрут и время</th>
                  <th>Продано</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trips.data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Рейсов нет
                    </td>
                  </tr>
                )}
                {trips.data.items.map((t) => {
                  const first = t.stops[0];
                  const last = t.stops[t.stops.length - 1];
                  const departed = first?.departureAt ? new Date(first.departureAt) < new Date() : false;
                  return (
                    <tr key={t.tripId} className={t.status === 'CANCELLED' ? 'text-slate-400' : ''}>
                      <td className="whitespace-nowrap font-medium">{fmtLongDate(t.date)}</td>
                      <td className="font-mono font-semibold">{t.trainNumber}</td>
                      <td>
                        <div className="font-medium">{t.routeName}</div>
                        <div className="text-xs text-slate-500">
                          {first && fmtTime(first.departureAt, first.timezone)} {first?.name} → {last && fmtTime(last.arrivalAt, last.timezone)} {last?.name}
                        </div>
                      </td>
                      <td>
                        <Link to={`/admin/bookings?tripId=${t.tripId}`} className="font-semibold text-blue-600 hover:underline">
                          {t.soldTickets}
                        </Link>
                      </td>
                      <td className="space-y-1">
                        {t.status === 'CANCELLED' ? <Badge color="red">Отменён</Badge> : departed ? <Badge>Отправился</Badge> : <Badge color="green">По расписанию</Badge>}
                        {t.scheduleChanged && <Badge color="amber">время изменено</Badge>}
                        {t.cancelReason && <div className="text-xs">{t.cancelReason}</div>}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {t.status === 'SCHEDULED' && (
                          <>
                            <Button variant="ghost" onClick={() => setSchedule(t)}>
                              Изменить время
                            </Button>
                            <Button variant="ghost" className="text-red-600!" onClick={() => setCancelling(t)}>
                              Отменить
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={trips.data.page} limit={trips.data.limit} total={trips.data.total} onPage={(p) => set('page', String(p))} />
        </>
      )}
      {schedule && <ScheduleModal trip={schedule} onClose={() => setSchedule(null)} />}
      {cancelling && <CancelTripModal trip={cancelling} onClose={() => setCancelling(null)} />}
    </>
  );
}
