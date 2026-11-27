import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { admin } from '../../api';
import { errorText } from '../../api/client';
import type { ApiError, SeatClass } from '../../api/types';
import { CarriageGrid, seatButtonClass } from '../../components/CarriageMap';
import { Badge, Button, ClassBadge, ErrorMessage, Field, PageSpinner, PageTitle } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { SEAT_CLASS_RU } from '../../utils/format';
import { TicketsConflictModal } from './AdminLayout';

interface TrainRow {
  id: number;
  number: string;
  name: string | null;
  isActive: boolean;
  carriagesCount: number;
  seatsCount: number;
  routesCount: number;
  classes: SeatClass[];
}

// ---------------------------------------------------------------- список поездов

export function AdminTrains() {
  const qc = useQueryClient();
  const toast = useToast();
  const trains = useQuery<TrainRow[]>({ queryKey: ['admin', 'trains'], queryFn: admin.trains });
  const [form, setForm] = useState({ number: '', name: '' });
  const [conflict, setConflict] = useState<ApiError | null>(null);

  const create = useMutation({
    mutationFn: () => admin.createTrain(form),
    onSuccess: () => {
      toast('Поезд создан. Теперь добавьте вагоны.', 'success');
      setForm({ number: '', name: '' });
      qc.invalidateQueries({ queryKey: ['admin', 'trains'] });
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const toggle = useMutation({
    mutationFn: (t: TrainRow) => admin.updateTrain(t.id, { isActive: !t.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'trains'] }),
    onError: (e: ApiError) => (e.code === 'HAS_CONFIRMED_TICKETS' ? setConflict(e) : toast(e.message, 'error')),
  });

  return (
    <>
      <PageTitle title="Поезда" subtitle="Поезд → вагоны (класс и схема) → места создаются автоматически" />
      <form
        className="card mb-6 grid items-end gap-3 p-4 sm:grid-cols-[160px_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Номер поезда">
          <input className="input uppercase" placeholder="T101" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
        </Field>
        <Field label="Название">
          <input className="input" placeholder="Moravia Express" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Button type="submit" loading={create.isPending}>
          + Создать поезд
        </Button>
      </form>

      {trains.isLoading && <PageSpinner />}
      {trains.isError && <ErrorMessage error={trains.error} />}
      {trains.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Название</th>
                <th>Вагоны</th>
                <th>Места</th>
                <th>Классы</th>
                <th>Маршруты</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trains.data.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/admin/trains/${t.id}`} className="font-bold text-blue-700 hover:underline">
                      {t.number}
                    </Link>
                  </td>
                  <td>{t.name ?? '—'}</td>
                  <td>{t.carriagesCount}</td>
                  <td>{t.seatsCount}</td>
                  <td className="space-x-1">{t.classes.map((c) => <ClassBadge key={c} seatClass={c} />)}</td>
                  <td>{t.routesCount}</td>
                  <td>{t.isActive ? <Badge color="green">Активен</Badge> : <Badge>Выключен</Badge>}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link to={`/admin/trains/${t.id}`} className="mr-2 text-sm font-semibold text-blue-600 hover:underline">
                      Вагоны и места
                    </Link>
                    <Button variant="ghost" onClick={() => toggle.mutate(t)}>
                      {t.isActive ? 'Выключить' : 'Включить'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {conflict && <TicketsConflictModal error={conflict} onClose={() => setConflict(null)} />}
    </>
  );
}

// ---------------------------------------------------------------- поезд: вагоны и места

interface CarriageAdmin {
  id: number;
  carriageNo: number;
  seatClass: SeatClass;
  rowsCount: number;
  layout: string;
  isActive: boolean;
  seats: { seatId: number; label: string; row: number; letter: string; isActive: boolean; hasFutureTickets: boolean }[];
}

/** Добавить вагон — номер, класс, число рядов, схема, предпросмотр */
function CarriageEditor({ trainId, nextNo, onDone }: { trainId: number; nextNo: number; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ carriageNo: nextNo, seatClass: 'ECONOMY' as SeatClass, rowsCount: 15, layout: 'AB_CD' });
  const layoutOk = /^[A-Z_]{1,10}$/.test(f.layout) && /[A-Z]/.test(f.layout);
  const letters = f.layout.replace(/_/g, '');
  const add = useMutation({
    mutationFn: () => admin.addCarriage(trainId, f),
    onSuccess: (c: { seatsCreated: number }) => {
      toast(`Вагон добавлен, создано мест: ${c.seatsCreated}`, 'success');
      onDone();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const preview = layoutOk
    ? Array.from({ length: Math.min(f.rowsCount, 3) }, (_, r) => letters.split('').map((l) => ({ seatId: r * 10 + l.charCodeAt(0), label: `${r + 1}${l}`, row: r + 1, letter: l })))
        .flat()
    : [];

  return (
    <div className="card p-4">
      <h2 className="mb-3 font-semibold">Добавить вагон</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Номер вагона">
          <input type="number" min={1} className="input" value={f.carriageNo} onChange={(e) => setF({ ...f, carriageNo: Number(e.target.value) })} />
        </Field>
        <Field label="Класс">
          <select
            className="input"
            value={f.seatClass}
            onChange={(e) => {
              const seatClass = e.target.value as SeatClass;
              setF({ ...f, seatClass, layout: seatClass === 'BUSINESS' ? 'A_BC' : 'AB_CD', rowsCount: seatClass === 'BUSINESS' ? 8 : 15 });
            }}
          >
            <option value="ECONOMY">Эконом</option>
            <option value="BUSINESS">Бизнес</option>
          </select>
        </Field>
        <Field label="Рядов">
          <input type="number" min={1} max={40} className="input" value={f.rowsCount} onChange={(e) => setF({ ...f, rowsCount: Number(e.target.value) })} />
        </Field>
        <Field label="Схема ряда" hint="Буквы мест, _ — проход" error={layoutOk ? undefined : 'Только буквы и _'}>
          <input className="input font-mono uppercase" value={f.layout} onChange={(e) => setF({ ...f, layout: e.target.value.toUpperCase() })} />
        </Field>
      </div>
      {layoutOk && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Предпросмотр (первые ряды): {letters.length} мест в ряду × {f.rowsCount} рядов = <b>{letters.length * f.rowsCount} мест</b>
          </p>
          <CarriageGrid rowsCount={Math.min(f.rowsCount, 3)} layout={f.layout} seats={preview} renderSeat={(s) => <span className={`${seatButtonClass('free')} inline-flex items-center justify-center`}>{s?.label}</span>} />
        </div>
      )}
      <Button className="mt-3" disabled={!layoutOk} loading={add.isPending} onClick={() => add.mutate()}>
        + Добавить вагон
      </Button>
    </div>
  );
}

export function AdminTrainDetails() {
  const { id } = useParams();
  const trainId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const data = useQuery<{ id: number; number: string; name: string | null; carriages: CarriageAdmin[] }>({
    queryKey: ['admin', 'train', trainId],
    queryFn: () => admin.carriages(trainId),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'train', trainId] });
    qc.invalidateQueries({ queryKey: ['admin', 'trains'] });
  };
  const onError = (e: ApiError) => (e.code === 'HAS_CONFIRMED_TICKETS' ? setConflict(e) : toast(e.message, 'error'));

  const updCarriage = useMutation({
    mutationFn: ({ cid, body }: { cid: number; body: unknown }) => admin.updateCarriage(cid, body),
    onSuccess: () => {
      refresh();
      toast('Вагон обновлён', 'success');
    },
    onError,
  });
  const updSeat = useMutation({ mutationFn: ({ sid, isActive }: { sid: number; isActive: boolean }) => admin.updateSeat(sid, { isActive }), onSuccess: refresh, onError });

  if (data.isLoading) return <PageSpinner />;
  if (data.isError) return <ErrorMessage error={data.error} />;
  const t = data.data!;
  const nextNo = Math.max(0, ...t.carriages.map((c) => c.carriageNo)) + 1;

  return (
    <>
      <PageTitle title={`Поезд ${t.number}`} subtitle={t.name ?? undefined} back={{ to: '/admin/trains', label: 'Все поезда' }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {t.carriages.length === 0 && <p className="text-slate-500">У поезда пока нет вагонов.</p>}
          {t.carriages.map((c) => (
            <div key={c.id} className={`card p-4 ${c.isActive ? '' : 'opacity-60'}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Вагон {c.carriageNo}</h2>
                  <ClassBadge seatClass={c.seatClass} />
                  <span className="text-sm text-slate-500">
                    {c.rowsCount} рядов · схема <code className="rounded bg-slate-100 px-1">{c.layout}</code> · {c.seats.filter((s) => s.isActive).length}/{c.seats.length} мест
                  </span>
                  {!c.isActive && <Badge>Выключен</Badge>}
                </div>
                <div className="flex gap-2">
                  <select
                    className="input w-auto"
                    aria-label="Класс вагона"
                    value={c.seatClass}
                    onChange={(e) => updCarriage.mutate({ cid: c.id, body: { seatClass: e.target.value } })}
                  >
                    <option value="ECONOMY">Эконом</option>
                    <option value="BUSINESS">Бизнес</option>
                  </select>
                  <Button variant="secondary" onClick={() => updCarriage.mutate({ cid: c.id, body: { isActive: !c.isActive } })}>
                    {c.isActive ? 'Выключить' : 'Включить'}
                  </Button>
                </div>
              </div>
              <p className="mb-2 text-xs text-slate-500">Нажмите на место, чтобы выключить/включить его. Места с проданными билетами отмечены точкой.</p>
              <CarriageGrid
                rowsCount={c.rowsCount}
                layout={c.layout}
                seats={c.seats}
                renderSeat={(s) =>
                  s ? (
                    <button
                      className={`${seatButtonClass(s.isActive ? 'free' : 'off')} relative`}
                      title={`${s.label}: ${s.isActive ? 'продаётся' : 'выключено'}${s.hasFutureTickets ? ', есть билеты' : ''}`}
                      aria-label={`Место ${s.label}, ${s.isActive ? 'включено' : 'выключено'}`}
                      onClick={() => updSeat.mutate({ sid: s.seatId, isActive: !s.isActive })}
                    >
                      {s.label}
                      {s.hasFutureTickets && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-blue-600" />}
                    </button>
                  ) : (
                    <span className={seatButtonClass('off')} />
                  )
                }
              />
            </div>
          ))}
        </div>
        <div>
          <CarriageEditor key={nextNo} trainId={trainId} nextNo={nextNo} onDone={refresh} />
          <p className="mt-3 text-xs text-slate-500">
            Классы: {Object.values(SEAT_CLASS_RU).join(', ')}. Класс задаётся на весь вагон, место наследует класс вагона.
          </p>
        </div>
      </div>
      {conflict && <TicketsConflictModal error={conflict} onClose={() => setConflict(null)} />}
    </>
  );
}
