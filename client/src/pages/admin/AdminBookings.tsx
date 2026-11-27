import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { admin, clean, ticketPdfUrl } from '../../api';
import { Button, ClassBadge, ErrorMessage, Field, PageSpinner, PageTitle, Pagination, StatusBadge } from '../../components/ui';
import { useStations } from '../../hooks/useStations';
import { fmtDate, fmtDateTime, fmtMoney, fmtTime } from '../../utils/format';

/** Все бронирования с фильтрами + «Скачать CSV» (раздел 10.13, п. 3) */
export function AdminBookings() {
  const [params, setParams] = useSearchParams();
  const stations = useStations();
  const filters = { ...Object.fromEntries(params.entries()), limit: '20' };
  const tickets = useQuery({ queryKey: ['admin', 'tickets', filters], queryFn: () => admin.tickets(clean(filters)), placeholderData: keepPreviousData });

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const val = (k: string) => params.get(k) ?? '';
  const exportParams = Object.fromEntries([...params.entries()].filter(([k]) => k !== 'page'));

  return (
    <>
      <PageTitle
        title="Бронирования"
        subtitle={tickets.data ? `Найдено: ${tickets.data.total}` : undefined}
        actions={
          <a href={admin.exportUrl(exportParams)} download className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            ⬇ Скачать CSV
          </a>
        }
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Field label="Статус">
          <select className="input" value={val('status')} onChange={(e) => set('status', e.target.value)}>
            <option value="">Все</option>
            <option value="CONFIRMED">Подтверждён</option>
            <option value="CANCELLED">Отменён</option>
          </select>
        </Field>
        <Field label="Номер поезда">
          <input className="input" placeholder="T101" value={val('trainNumber')} onChange={(e) => set('trainNumber', e.target.value)} />
        </Field>
        <Field label="ID рейса">
          <input type="number" className="input" value={val('tripId')} onChange={(e) => set('tripId', e.target.value)} />
        </Field>
        <Field label="Станция">
          <select className="input" value={val('stationId')} onChange={(e) => set('stationId', e.target.value)}>
            <option value="">Любая</option>
            {stations.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Сортировка">
          <select className="input" value={val('sort')} onChange={(e) => set('sort', e.target.value)}>
            <option value="">Сначала новые</option>
            <option value="departure_asc">По дате поездки</option>
          </select>
        </Field>
        <Field label="Поездка с">
          <input type="date" className="input" value={val('dateFrom')} onChange={(e) => set('dateFrom', e.target.value)} />
        </Field>
        <Field label="Поездка по">
          <input type="date" className="input" value={val('dateTo')} onChange={(e) => set('dateTo', e.target.value)} />
        </Field>
        <Field label="Email пассажира">
          <input className="input" placeholder="anna@" value={val('email')} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Номер билета">
          <input className="input" placeholder="TTX-" value={val('ticketNumber')} onChange={(e) => set('ticketNumber', e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>
            Сбросить
          </Button>
        </div>
      </div>

      {tickets.isLoading && <PageSpinner />}
      {tickets.isError && <ErrorMessage error={tickets.error} />}
      {tickets.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Билет</th>
                  <th>Пассажир</th>
                  <th>Поезд / рейс</th>
                  <th>Поездка</th>
                  <th>Место</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Куплен</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tickets.data.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Ничего не найдено
                    </td>
                  </tr>
                )}
                {tickets.data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs font-semibold">{t.ticketNumber}</td>
                    <td>
                      <div className="font-medium">{t.passengerName}</div>
                      <div className="text-xs text-slate-500">{t.userEmail}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-mono font-semibold">{t.trainNumber}</span> <span className="text-xs text-slate-400">#{t.tripId}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <div>
                        {t.from.name} → {t.to.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fmtDate(t.from.departureAt, t.from.timezone)} {fmtTime(t.from.departureAt, t.from.timezone)}–{fmtTime(t.to.arrivalAt, t.to.timezone)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {t.seat.carriageNo}/{t.seat.label} <ClassBadge seatClass={t.seat.seatClass} />
                    </td>
                    <td className="whitespace-nowrap font-semibold">{fmtMoney(t.price)}</td>
                    <td>
                      <StatusBadge status={t.displayStatus} />
                      {t.cancelledBy === 'ADMIN' && <div className="text-xs text-slate-400">админом</div>}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(t.createdAt)}</td>
                    <td>
                      <a href={ticketPdfUrl(t.id)} download className="text-sm font-semibold text-blue-600 hover:underline">
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={tickets.data.page} limit={tickets.data.limit} total={tickets.data.total} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
