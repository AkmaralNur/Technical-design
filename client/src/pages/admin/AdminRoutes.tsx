import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { admin } from '../../api';
import { errorText } from '../../api/client';
import type { SeatClass, Station } from '../../api/types';
import { Alert, Badge, Button, ErrorMessage, Field, PageSpinner, PageTitle } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { offsetToClock, SEAT_CLASS_RU } from '../../utils/format';

interface StopRow {
  stationId: number | '';
  arrivalOffsetMin: number | '' | null;
  departureOffsetMin: number | '' | null;
}

interface RouteDetail {
  id: number;
  name: string;
  trainId: number;
  trainNumber: string;
  departureTime: string;
  timezone: string;
  isActive: boolean;
  tripsCount: number;
  classes: SeatClass[];
  stops: { stopOrder: number; stationId: number; name: string; code: string; arrivalOffsetMin: number | null; departureOffsetMin: number | null }[];
  fares: { from: number; to: number; seatClass: SeatClass; price: string; currency: string }[];
  currency: string;
  missing: { from: number; to: number; seatClass: SeatClass }[];
}

const TZ = ['Europe/Prague', 'Europe/Vienna', 'Europe/Bratislava', 'Europe/Berlin', 'Europe/Warsaw', 'Asia/Almaty'];

function toPayload(stops: StopRow[]) {
  const num = (v: number | '' | null) => (v === '' || v === null ? null : Number(v));
  return stops.map((s) => ({ stationId: Number(s.stationId), arrivalOffsetMin: num(s.arrivalOffsetMin), departureOffsetMin: num(s.departureOffsetMin) }));
}

/** Админ: добавить, удалить, переставить остановки, ввести время (в минутах от старта) */
function StopsEditor({ stops, setStops, stations, start }: { stops: StopRow[]; setStops: (s: StopRow[]) => void; stations: Station[]; start: string }) {
  const update = (i: number, patch: Partial<StopRow>) => setStops(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const next = [...stops];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setStops(next);
  };
  const last = stops.length - 1;
  return (
    <div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Станция</th>
              <th>Прибытие, мин от старта</th>
              <th>Отправление, мин от старта</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stops.map((s, i) => (
              <tr key={i}>
                <td className="text-slate-400">{i}</td>
                <td className="min-w-44">
                  <select className="input" value={s.stationId} onChange={(e) => update(i, { stationId: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">— станция —</option>
                    {stations.map((st) => (
                      <option key={st.id} value={st.id} disabled={stops.some((x, j) => j !== i && x.stationId === st.id)}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {i === 0 ? (
                    <span className="text-xs text-slate-400">начало маршрута</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} className="input w-24" value={s.arrivalOffsetMin ?? ''} onChange={(e) => update(i, { arrivalOffsetMin: e.target.value === '' ? '' : Number(e.target.value) })} />
                      <span className="text-xs tabular-nums text-slate-500">{offsetToClock(start, s.arrivalOffsetMin === '' ? null : s.arrivalOffsetMin)}</span>
                    </div>
                  )}
                </td>
                <td>
                  {i === last ? (
                    <span className="text-xs text-slate-400">конечная</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} className="input w-24" value={s.departureOffsetMin ?? ''} onChange={(e) => update(i, { departureOffsetMin: e.target.value === '' ? '' : Number(e.target.value) })} />
                      <span className="text-xs tabular-nums text-slate-500">{offsetToClock(start, s.departureOffsetMin === '' ? null : s.departureOffsetMin)}</span>
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  <Button variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше">↑</Button>
                  <Button variant="ghost" disabled={i === last} onClick={() => move(i, 1)} aria-label="Ниже">↓</Button>
                  <Button variant="ghost" disabled={stops.length <= 2} onClick={() => setStops(stops.filter((_, j) => j !== i))} aria-label="Удалить">✕</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" className="mt-2" onClick={() => setStops([...stops, { stationId: '', arrivalOffsetMin: '', departureOffsetMin: '' }])}>
        + Остановка
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- список + создание

export function AdminRoutes() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const routes = useQuery<{ id: number; name: string; trainNumber: string; departureTime: string; timezone: string; isActive: boolean; stops: string[]; tripsCount: number; missingFares: number }[]>({
    queryKey: ['admin', 'routes'],
    queryFn: admin.routes,
  });
  const trains = useQuery<{ id: number; number: string; name: string | null }[]>({ queryKey: ['admin', 'trains'], queryFn: admin.trains });
  const stations = useQuery({ queryKey: ['admin', 'stations'], queryFn: admin.stations });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ trainId: '', name: '', departureTime: '07:00', timezone: 'Europe/Prague' });
  const [stops, setStops] = useState<StopRow[]>([
    { stationId: '', arrivalOffsetMin: null, departureOffsetMin: 0 },
    { stationId: '', arrivalOffsetMin: '', departureOffsetMin: null },
  ]);

  const create = useMutation({
    mutationFn: () => admin.createRoute({ ...form, trainId: Number(form.trainId), stops: toPayload(stops) }),
    onSuccess: (r: RouteDetail) => {
      qc.invalidateQueries({ queryKey: ['admin', 'routes'] });
      toast('Маршрут создан. Теперь задайте цены.', 'success');
      navigate(`/admin/routes/${r.id}`);
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <>
      <PageTitle
        title="Маршруты и цены"
        subtitle="Маршрут — шаблон: остановки, время и цены. Из него создаются рейсы на даты."
        actions={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Скрыть форму' : '+ Новый маршрут'}</Button>}
      />

      {showForm && (
        <div className="card mb-6 space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Поезд">
              <select className="input" value={form.trainId} onChange={(e) => setForm({ ...form, trainId: e.target.value })}>
                <option value="">— выберите —</option>
                {trains.data?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.number} {t.name ? `· ${t.name}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Название">
              <input className="input" placeholder="Prague – Vienna утренний" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Отправление с первой станции">
              <input type="time" className="input" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} />
            </Field>
            <Field label="Часовой пояс времени">
              <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {TZ.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <StopsEditor stops={stops} setStops={setStops} stations={(stations.data ?? []).filter((s: Station) => s.isActive)} start={form.departureTime} />
          <Button loading={create.isPending} disabled={!form.trainId || !form.name || stops.some((s) => !s.stationId)} onClick={() => create.mutate()}>
            Создать маршрут
          </Button>
        </div>
      )}

      {routes.isLoading && <PageSpinner />}
      {routes.isError && <ErrorMessage error={routes.error} />}
      {routes.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Маршрут</th>
                <th>Поезд</th>
                <th>Остановки</th>
                <th>Старт</th>
                <th>Цены</th>
                <th>Рейсов</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {routes.data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/admin/routes/${r.id}`} className="font-semibold text-blue-700 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="font-mono">{r.trainNumber}</td>
                  <td className="text-slate-600">{r.stops.join(' → ')}</td>
                  <td className="whitespace-nowrap">
                    {r.departureTime} <span className="text-xs text-slate-400">{r.timezone}</span>
                  </td>
                  <td>{r.missingFares ? <Badge color="amber">не хватает {r.missingFares}</Badge> : <Badge color="green">заполнены</Badge>}</td>
                  <td>{r.tripsCount}</td>
                  <td>{r.isActive ? <Badge color="green">Активен</Badge> : <Badge>Выключен</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- редактор маршрута

/** Таблица цен «откуда × куда», отдельно для Эконом и Бизнес */
function FaresMatrix({ route, onSaved }: { route: RouteDetail; onSaved: (r: RouteDetail) => void }) {
  const toast = useToast();
  const key = (f: number, t: number, c: string) => `${f}-${t}-${c}`;
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState(route.currency);
  useEffect(() => {
    setPrices(Object.fromEntries(route.fares.map((f) => [key(f.from, f.to, f.seatClass), f.price])));
    setCurrency(route.currency);
  }, [route]);

  const save = useMutation({
    mutationFn: () =>
      admin.setFares(route.id, {
        currency,
        fares: Object.entries(prices)
          .filter(([, v]) => v !== '')
          .map(([k, price]) => {
            const [from, to, seatClass] = k.split('-');
            return { from: Number(from), to: Number(to), seatClass, price };
          })
          .filter((f) => f.to < route.stops.length && route.classes.includes(f.seatClass as SeatClass)),
      }),
    onSuccess: (r: RouteDetail) => {
      onSaved(r);
      toast(r.missing.length ? `Сохранено. Не хватает цен: ${r.missing.length}` : 'Цены сохранены', r.missing.length ? 'info' : 'success');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  const n = route.stops.length;
  if (!route.classes.length) return <Alert kind="warning">У поезда нет активных вагонов — добавьте вагоны, чтобы задать цены.</Alert>;

  return (
    <div className="space-y-5">
      {route.classes.map((cls) => (
        <div key={cls}>
          <h3 className="mb-2 font-semibold">{SEAT_CLASS_RU[cls]}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Откуда \ Куда</th>
                  {route.stops.slice(1).map((s) => (
                    <th key={s.stopOrder}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {route.stops.slice(0, n - 1).map((from) => (
                  <tr key={from.stopOrder}>
                    <td className="font-medium">{from.name}</td>
                    {route.stops.slice(1).map((to) => {
                      if (to.stopOrder <= from.stopOrder) return <td key={to.stopOrder} className="bg-slate-50" />;
                      const k = key(from.stopOrder, to.stopOrder, cls);
                      const missing = !prices[k];
                      return (
                        <td key={to.stopOrder}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`${from.name} → ${to.name}, ${SEAT_CLASS_RU[cls]}`}
                            className={`input w-24 ${missing ? 'border-amber-400 bg-amber-50' : ''}`}
                            value={prices[k] ?? ''}
                            onChange={(e) => setPrices({ ...prices, [k]: e.target.value })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="flex items-end gap-3">
        <Field label="Валюта">
          <input className="input w-24 uppercase" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </Field>
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Сохранить цены
        </Button>
      </div>
    </div>
  );
}

export function AdminRouteEditor() {
  const { id } = useParams();
  const routeId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const route = useQuery<RouteDetail>({ queryKey: ['admin', 'route', routeId], queryFn: () => admin.route(routeId) });
  const stations = useQuery({ queryKey: ['admin', 'stations'], queryFn: admin.stations });
  const [info, setInfo] = useState({ name: '', departureTime: '', timezone: '' });
  const [stops, setStops] = useState<StopRow[]>([]);

  useEffect(() => {
    if (!route.data) return;
    setInfo({ name: route.data.name, departureTime: route.data.departureTime, timezone: route.data.timezone });
    setStops(route.data.stops.map((s) => ({ stationId: s.stationId, arrivalOffsetMin: s.arrivalOffsetMin, departureOffsetMin: s.departureOffsetMin })));
  }, [route.data]);

  const setData = (r: RouteDetail) => {
    qc.setQueryData(['admin', 'route', routeId], r);
    qc.invalidateQueries({ queryKey: ['admin', 'routes'] });
  };
  const saveInfo = useMutation({
    mutationFn: (body: unknown) => admin.updateRoute(routeId, body),
    onSuccess: (r: RouteDetail) => {
      setData(r);
      toast('Маршрут сохранён', 'success');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const saveStops = useMutation({
    mutationFn: () => admin.updateStops(routeId, { stops: toPayload(stops) }),
    onSuccess: (r: RouteDetail) => {
      setData(r);
      toast('Остановки сохранены. Уже созданные рейсы не изменились.', 'success');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  if (route.isLoading) return <PageSpinner />;
  if (route.isError) return <ErrorMessage error={route.error} />;
  const r = route.data!;

  return (
    <>
      <PageTitle
        title={r.name}
        subtitle={<>Поезд {r.trainNumber} · рейсов создано: {r.tripsCount}</>}
        back={{ to: '/admin/routes', label: 'Все маршруты' }}
        actions={
          <Link to={`/admin/trips?routeId=${r.id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Рейсы этого маршрута →
          </Link>
        }
      />
      {r.missing.length > 0 && (
        <div className="mb-4">
          <Alert kind="warning">Не заданы цены для {r.missing.length} пар остановок. Пока цены не заполнены, рейсы создать нельзя.</Alert>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card space-y-4 p-4">
          <h2 className="font-semibold">Основное</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Название">
              <input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
            </Field>
            <Field label="Отправление">
              <input type="time" className="input" value={info.departureTime} onChange={(e) => setInfo({ ...info, departureTime: e.target.value })} />
            </Field>
            <Field label="Часовой пояс">
              <select className="input" value={info.timezone} onChange={(e) => setInfo({ ...info, timezone: e.target.value })}>
                {[...new Set([info.timezone, ...TZ])].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button loading={saveInfo.isPending} onClick={() => saveInfo.mutate(info)}>
              Сохранить
            </Button>
            <Button variant="secondary" onClick={() => saveInfo.mutate({ isActive: !r.isActive })}>
              {r.isActive ? 'Выключить маршрут' : 'Включить маршрут'}
            </Button>
            {!r.isActive && <Badge>Выключен — новые рейсы не создаются</Badge>}
          </div>
          <p className="text-xs text-slate-500">Изменения шаблона действуют только на новые рейсы. Купленные билеты не меняются.</p>

          <h2 className="pt-2 font-semibold">Остановки</h2>
          <StopsEditor stops={stops} setStops={setStops} stations={stations.data ?? []} start={info.departureTime} />
          <Button loading={saveStops.isPending} disabled={stops.some((s) => !s.stationId)} onClick={() => saveStops.mutate()}>
            Сохранить остановки
          </Button>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Цены по участкам и классам</h2>
          <FaresMatrix route={r} onSaved={setData} />
        </section>
      </div>
    </>
  );
}
