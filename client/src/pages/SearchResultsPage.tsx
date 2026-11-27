import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { clean, searchTrips } from '../api';
import { Container } from '../components/Layout';
import { SearchForm } from '../components/SearchForm';
import { TripCard } from '../components/TripCard';
import { Button, EmptyState, ErrorMessage, PageSpinner } from '../components/ui';
import { useStations } from '../hooks/useStations';
import { addDaysIso, fmtLongDate, fmtShortDate, todayIso } from '../utils/format';

const FILTER_KEYS = ['departAfter', 'departBefore', 'seatClass', 'maxPrice', 'onlyAvailable', 'sort'] as const;

/** Фильтры поиска: время, класс, макс. цена, только со свободными местами, сортировка */
function SearchFilters({ params, set }: { params: URLSearchParams; set: (k: string, v: string) => void }) {
  return (
    <aside className="card h-fit space-y-4 p-4">
      <h2 className="font-semibold">Фильтры</h2>
      <div>
        <span className="label">Время отправления</span>
        <div className="flex items-center gap-2">
          <input type="time" className="input" aria-label="Не раньше" value={params.get('departAfter') ?? ''} onChange={(e) => set('departAfter', e.target.value)} />
          <span className="text-slate-400">–</span>
          <input type="time" className="input" aria-label="Не позже" value={params.get('departBefore') ?? ''} onChange={(e) => set('departBefore', e.target.value)} />
        </div>
      </div>
      <label className="block">
        <span className="label">Класс</span>
        <select className="input" value={params.get('seatClass') ?? ''} onChange={(e) => set('seatClass', e.target.value)}>
          <option value="">Любой</option>
          <option value="ECONOMY">Эконом</option>
          <option value="BUSINESS">Бизнес</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Цена до, EUR</span>
        <input type="number" min={0} step="1" className="input" placeholder="любая" value={params.get('maxPrice') ?? ''} onChange={(e) => set('maxPrice', e.target.value)} />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-600"
          checked={params.get('onlyAvailable') === 'true'}
          onChange={(e) => set('onlyAvailable', e.target.checked ? 'true' : '')}
        />
        Только со свободными местами
      </label>
      <fieldset>
        <legend className="label">Сортировка</legend>
        {[
          ['departure', 'по времени'],
          ['price', 'по цене'],
          ['duration', 'по длительности'],
        ].map(([v, t]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
            <input type="radio" name="sort" className="accent-blue-600" checked={(params.get('sort') ?? 'departure') === v} onChange={() => set('sort', v === 'departure' ? '' : v)} />
            {t}
          </label>
        ))}
      </fieldset>
      {FILTER_KEYS.some((k) => params.get(k)) && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => FILTER_KEYS.forEach((k) => set(k, ''))}
        >
          Сбросить фильтры
        </Button>
      )}
    </aside>
  );
}

export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const stations = useStations();
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const date = params.get('date') ?? todayIso();
  const query = Object.fromEntries(params.entries());

  const result = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchTrips(clean(query)),
    enabled: !!from && !!to,
    placeholderData: keepPreviousData,
  });

  // фильтры хранятся в адресе страницы (раздел 10.13)
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const dayLink = (d: string) => {
    const next = new URLSearchParams(params);
    next.set('date', d);
    return `/search?${next.toString()}`;
  };

  const fromName = stations.data?.find((s) => String(s.id) === from)?.name ?? '…';
  const toName = stations.data?.find((s) => String(s.id) === to)?.name ?? '…';
  const prev = addDaysIso(date, -1);
  const next = addDaysIso(date, 1);

  return (
    <Container>
      <div className="card mb-6 p-4">
        <SearchForm key={`${from}-${to}-${date}`} initial={{ from, to, date }} compact />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {fromName} → {toName}
          </h1>
          <p className="text-slate-500">{fmtLongDate(date)}</p>
        </div>
        <div className="flex gap-2">
          {prev >= todayIso() && (
            <Link to={dayLink(prev)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
              ← {fmtShortDate(prev)}
            </Link>
          )}
          <Link to={dayLink(next)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            {fmtShortDate(next)} →
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <SearchFilters params={params} set={set} />
        <div className="space-y-4">
          {result.isLoading && <PageSpinner />}
          {result.isError && <ErrorMessage error={result.error} onRetry={() => result.refetch()} />}
          {result.data && result.data.items.length === 0 && (
            <EmptyState
              title="На эту дату поездов нет"
              text="Попробуйте другую дату или измените фильтры."
              action={
                <Link to={dayLink(next)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Смотреть {fmtShortDate(next)}
                </Link>
              }
            />
          )}
          {result.data && result.data.items.length > 0 && (
            <>
              <p className="text-sm text-slate-500">Найдено поездов: {result.data.items.length}</p>
              {result.data.items.map((item) => (
                <TripCard key={item.tripId} item={item} />
              ))}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
