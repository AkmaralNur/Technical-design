import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getSeatMap, getTrip } from '../api';
import type { SeatInfo } from '../api/types';
import { CarriageGrid, SeatLegend, seatButtonClass } from '../components/CarriageMap';
import { Container } from '../components/Layout';
import { StopsTimeline } from '../components/StopsTimeline';
import { Alert, Badge, Button, ErrorMessage, PageSpinner, PageTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { saveSelection } from '../utils/booking';
import { fmtDuration, fmtLongDate, fmtMoney, SEAT_CLASS_RU, seatsWord } from '../utils/format';

/** Рейс и выбор места (раздел 17.3) */
export function TripDetailsPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tripId = Number(id);
  const from = Number(params.get('from'));
  const to = Number(params.get('to'));
  const valid = Number.isInteger(tripId) && params.has('from') && params.has('to');

  const trip = useQuery({ queryKey: ['trip', tripId, from, to], queryFn: () => getTrip(tripId, from, to), enabled: valid });
  const seatMap = useQuery({ queryKey: ['seats', tripId, from, to], queryFn: () => getSeatMap(tripId, from, to), enabled: valid, staleTime: 0, refetchInterval: 30_000 });

  const [carriageNo, setCarriageNo] = useState<number | null>(null);
  const [selected, setSelected] = useState<SeatInfo | null>(null);

  useEffect(() => {
    if (seatMap.data && carriageNo === null) {
      const firstFree = seatMap.data.carriages.find((c) => c.freeSeats > 0) ?? seatMap.data.carriages[0];
      if (firstFree) setCarriageNo(firstFree.carriageNo);
    }
  }, [seatMap.data, carriageNo]);

  // если выбранное место заняли, пока пассажир думал — снимаем выбор
  useEffect(() => {
    if (!selected || !seatMap.data) return;
    const fresh = seatMap.data.carriages.flatMap((c) => c.seats).find((s) => s.seatId === selected.seatId);
    if (fresh && !fresh.available) setSelected(null);
  }, [seatMap.data, selected]);

  if (!valid) return <Container><ErrorMessage error={{ message: 'Не выбран участок поездки. Начните с поиска.' }} /></Container>;
  if (trip.isLoading || seatMap.isLoading) return <PageSpinner />;
  if (trip.isError) return <Container><ErrorMessage error={trip.error} onRetry={() => trip.refetch()} /></Container>;
  if (!trip.data) return null;

  const t = trip.data;
  const fromStop = t.stops.find((s) => s.stopOrder === from)!;
  const toStop = t.stops.find((s) => s.stopOrder === to)!;
  const carriage = seatMap.data?.carriages.find((c) => c.carriageNo === carriageNo);
  const canBook = t.status === 'SCHEDULED' && !t.selected?.departed;

  const next = () => {
    if (!selected || !carriage?.price) return;
    saveSelection({
      tripId,
      seatId: selected.seatId,
      fromStopOrder: from,
      toStopOrder: to,
      seatLabel: selected.label,
      carriageNo: carriage.carriageNo,
      seatClass: carriage.seatClass,
      price: carriage.price.amount,
      currency: carriage.price.currency,
      trainNumber: t.trainNumber,
      trainName: t.trainName,
      date: t.date,
      fromName: fromStop.name,
      toName: toStop.name,
      departureAt: fromStop.departureAt!,
      arrivalAt: toStop.arrivalAt!,
      fromTz: fromStop.timezone,
      toTz: toStop.timezone,
    });
    navigate(user ? '/booking/review' : `/login?next=${encodeURIComponent('/booking/review')}`);
  };

  return (
    <Container className="pb-32">
      <PageTitle
        title={`${t.trainNumber} · ${fromStop.name} → ${toStop.name}`}
        subtitle={
          <>
            {t.trainName && <>{t.trainName} · </>}
            {fmtLongDate(t.date)} · в пути {fmtDuration(t.selected?.durationMinutes)}
          </>
        }
        back={{ to: 'back', label: 'Назад к результатам' }}
      />

      <div className="mb-4 space-y-3">
        {t.status === 'CANCELLED' && <Alert kind="error">Этот рейс отменён{t.cancelReason ? `: ${t.cancelReason}` : ''}.</Alert>}
        {t.selected?.departed && t.status !== 'CANCELLED' && <Alert kind="warning">Поезд уже отправился со станции {fromStop.name}.</Alert>}
        {t.scheduleChanged && <Alert kind="warning">⚠️ Расписание этого рейса изменено. Время ниже — актуальное.</Alert>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Остановки</h2>
          <StopsTimeline stops={t.stops} from={from} to={to} />
          {t.selected && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="label">Цена участка</h3>
              {t.selected.prices.map((p) => (
                <div key={p.seatClass} className="flex justify-between py-0.5 text-sm">
                  <span>{SEAT_CLASS_RU[p.seatClass]}</span>
                  <span className="font-semibold">{p.amount} {p.currency}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card min-w-0 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Выберите место</h2>
            <SeatLegend />
          </div>

          {seatMap.isError && <ErrorMessage error={seatMap.error} onRetry={() => seatMap.refetch()} />}

          {/* вкладки вагонов с классом и ценой */}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
            {seatMap.data?.carriages.map((c) => (
              <button
                key={c.carriageNo}
                role="tab"
                aria-selected={c.carriageNo === carriageNo}
                onClick={() => setCarriageNo(c.carriageNo)}
                className={`shrink-0 rounded-xl border-2 px-4 py-2 text-left transition ${
                  c.carriageNo === carriageNo ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-bold">Вагон {c.carriageNo}</div>
                <div className="text-xs text-slate-500">
                  {SEAT_CLASS_RU[c.seatClass]} · {fmtMoney(c.price)}
                </div>
                <div className={`text-xs ${c.freeSeats ? 'text-emerald-700' : 'text-slate-400'}`}>{c.freeSeats ? `своб. ${seatsWord(c.freeSeats)}` : 'нет мест'}</div>
              </button>
            ))}
          </div>

          {carriage && (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm">
                <span className="font-semibold">Вагон {carriage.carriageNo}</span>
                {carriage.seatClass === 'BUSINESS' ? <Badge color="violet">Бизнес</Badge> : <Badge color="blue">Эконом</Badge>}
                <span className="text-slate-500">{fmtMoney(carriage.price)}</span>
              </div>
              <CarriageGrid
                rowsCount={carriage.rowsCount}
                layout={carriage.layout}
                seats={carriage.seats}
                renderSeat={(seat, letter) => {
                  if (!seat) return <span className={seatButtonClass('off')} aria-hidden />;
                  const isSel = selected?.seatId === seat.seatId;
                  const state = isSel ? 'selected' : seat.available && canBook ? 'free' : 'taken';
                  return (
                    <button
                      type="button"
                      className={seatButtonClass(state)}
                      disabled={state === 'taken'}
                      onClick={() => setSelected(isSel ? null : seat)}
                      aria-pressed={isSel}
                      aria-label={`Вагон ${carriage.carriageNo}, место ${seat.label}, ${isSel ? 'выбрано' : seat.available ? 'свободно' : 'занято'}`}
                      title={seat.label}
                    >
                      {letter === seat.letter ? seat.label : ''}
                    </button>
                  );
                }}
              />
            </>
          )}
        </section>
      </div>

      {/* панель выбранного места */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {selected && carriage ? (
            <div className="text-sm">
              Выбрано: <b>вагон {carriage.carriageNo}, место {selected.label}</b>, {SEAT_CLASS_RU[carriage.seatClass]} ·{' '}
              <b className="text-blue-700">{fmtMoney(carriage.price)}</b>
            </div>
          ) : (
            <div className="text-sm text-slate-500">{canBook ? 'Нажмите на свободное место на схеме' : 'Бронирование недоступно'}</div>
          )}
          <Button onClick={next} disabled={!selected || !canBook} className="px-8">
            Далее →
          </Button>
        </div>
      </div>
    </Container>
  );
}
