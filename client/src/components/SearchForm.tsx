import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStations } from '../hooks/useStations';
import { todayIso } from '../utils/format';
import { Button } from './ui';

interface Props {
  initial?: { from?: string; to?: string; date?: string };
  compact?: boolean;
}

/** Поля «откуда», «куда», «дата», кнопка «поменять местами», проверка одинаковых станций */
export function SearchForm({ initial, compact }: Props) {
  const navigate = useNavigate();
  const stations = useStations();
  const [from, setFrom] = useState(initial?.from ?? '');
  const [to, setTo] = useState(initial?.to ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const same = !!from && from === to;
  const canSubmit = !!from && !!to && !!date && !same;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    navigate(`/search?${new URLSearchParams({ from, to, date }).toString()}`);
  };

  const options = (stations.data ?? []).map((s) => (
    <option key={s.id} value={s.id}>
      {s.name} ({s.code})
    </option>
  ));

  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? 'md:grid-cols-[1fr_auto_1fr_180px_auto]' : 'md:grid-cols-[1fr_auto_1fr]'} items-end`}>
      <label className="block">
        <span className="label">Откуда</span>
        <select className="input h-11" value={from} onChange={(e) => setFrom(e.target.value)} required>
          <option value="">Станция отправления</option>
          {options}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          setFrom(to);
          setTo(from);
        }}
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-600 shadow-sm transition hover:rotate-180 hover:bg-slate-50"
        aria-label="Поменять станции местами"
        title="Поменять местами"
      >
        ⇄
      </button>
      <label className="block">
        <span className="label">Куда</span>
        <select className="input h-11" value={to} onChange={(e) => setTo(e.target.value)} required>
          <option value="">Станция прибытия</option>
          {options}
        </select>
      </label>
      <div className={compact ? 'contents' : 'grid gap-3 sm:grid-cols-[1fr_auto] md:col-span-3'}>
        <label className="block">
          <span className="label">Дата</span>
          <input type="date" className="input h-11" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <Button type="submit" disabled={!canSubmit} className="h-11 px-6">
          🔍 Найти поезда
        </Button>
      </div>
      {same && <p className="text-sm font-medium text-red-600 md:col-span-3">Станции отправления и прибытия должны быть разными</p>}
    </form>
  );
}
