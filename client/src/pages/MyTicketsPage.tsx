import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { clean, getMyTickets } from '../api';
import { Container } from '../components/Layout';
import { TicketCard } from '../components/TicketCard';
import { Button, EmptyState, ErrorMessage, PageSpinner, PageTitle, Pagination } from '../components/ui';

const TABS = [
  ['upcoming', 'Предстоящие'],
  ['completed', 'Завершённые'],
  ['cancelled', 'Отменённые'],
] as const;

/** Мои билеты: 3 вкладки + фильтры (раздел 10.13, п. 2) */
export function MyTicketsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'upcoming';
  const query = { ...Object.fromEntries(params.entries()), status, limit: '10' };
  const tickets = useQuery({ queryKey: ['tickets', query], queryFn: () => getMyTickets(clean(query)), placeholderData: keepPreviousData });

  const set = (k: string, v: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (resetPage && k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const dateError = params.get('dateFrom') && params.get('dateTo') && params.get('dateFrom')! > params.get('dateTo')!;

  return (
    <Container className="max-w-4xl">
      <PageTitle title="Мои билеты" />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={status === key}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set('status', key);
              next.delete('page');
              next.delete('sort');
              setParams(next);
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${status === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* фильтры: период, поиск, сортировка */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Дата от</span>
          <input type="date" className="input" value={params.get('dateFrom') ?? ''} onChange={(e) => set('dateFrom', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Дата до</span>
          <input type="date" className="input" value={params.get('dateTo') ?? ''} onChange={(e) => set('dateTo', e.target.value)} />
          {dateError && <span className="mt-1 block text-xs text-red-600">Дата «до» раньше даты «от»</span>}
        </label>
        <label className="block">
          <span className="label">Поиск</span>
          <input className="input" placeholder="Номер билета или станция" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Сортировка</span>
          <select className="input" value={params.get('sort') ?? (status === 'upcoming' ? 'date_asc' : 'date_desc')} onChange={(e) => set('sort', e.target.value)}>
            <option value="date_asc">Сначала ближайшие</option>
            <option value="date_desc">Сначала поздние</option>
          </select>
        </label>
      </div>

      {tickets.isLoading && <PageSpinner />}
      {tickets.isError && !dateError && <ErrorMessage error={tickets.error} onRetry={() => tickets.refetch()} />}
      {tickets.data && tickets.data.items.length === 0 && (
        <EmptyState
          icon="🎫"
          title={status === 'upcoming' ? 'Предстоящих поездок нет' : status === 'completed' ? 'Завершённых поездок нет' : 'Отменённых билетов нет'}
          text={params.get('q') || params.get('dateFrom') || params.get('dateTo') ? 'Попробуйте изменить фильтры.' : undefined}
          action={
            status === 'upcoming' ? (
              <Link to="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Найти поезд
              </Link>
            ) : undefined
          }
        />
      )}
      <div className="space-y-3">{tickets.data?.items.map((t) => <TicketCard key={t.id} t={t} />)}</div>
      {tickets.data && <Pagination page={tickets.data.page} limit={tickets.data.limit} total={tickets.data.total} onPage={(p) => set('page', String(p), false)} />}
      {(params.get('q') || params.get('dateFrom') || params.get('dateTo')) && (
        <Button variant="ghost" className="mt-3" onClick={() => setParams(new URLSearchParams({ status }))}>
          Сбросить фильтры
        </Button>
      )}
    </Container>
  );
}
