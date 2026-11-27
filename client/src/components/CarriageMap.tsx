import type { ReactNode } from 'react';

export interface MapSeat {
  seatId: number;
  label: string;
  row: number;
  letter: string;
}

/**
 * Схема вагона по rowsCount и layout (алгоритм 10.10):
 * буква → кнопка места, '_' → проход.
 */
export function CarriageGrid<S extends MapSeat>({
  rowsCount,
  layout,
  seats,
  renderSeat,
}: {
  rowsCount: number;
  layout: string;
  seats: S[];
  renderSeat: (seat: S | undefined, letter: string, row: number) => ReactNode;
}) {
  const byKey = new Map(seats.map((s) => [`${s.row}${s.letter}`, s]));
  const cols = layout.split('');
  return (
    <div className="overflow-x-auto pb-2">
      <div className="mx-auto w-max rounded-3xl border-2 border-slate-300 bg-slate-50 px-4 py-5">
        <div className="mb-2 flex items-center gap-1.5 pl-8">
          {cols.map((c, i) =>
            c === '_' ? (
              <span key={i} className="w-6" />
            ) : (
              <span key={i} className="w-10 text-center text-xs font-bold text-slate-400">
                {c}
              </span>
            ),
          )}
        </div>
        {Array.from({ length: rowsCount }, (_, r) => r + 1).map((row) => (
          <div key={row} className="mb-1.5 flex items-center gap-1.5">
            <span className="w-7 text-right text-xs font-semibold tabular-nums text-slate-400">{row}</span>
            {cols.map((c, i) =>
              c === '_' ? (
                <span key={i} className="w-6" aria-hidden />
              ) : (
                <span key={i}>{renderSeat(byKey.get(`${row}${c}`), c, row)}</span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeatLegend() {
  const item = (cls: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-5 w-5 rounded-md ${cls}`} /> {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {item('border-2 border-slate-300 bg-white', 'свободно')}
      {item('bg-slate-300', 'занято')}
      {item('bg-blue-600', 'выбрано')}
    </div>
  );
}

export function seatButtonClass(state: 'free' | 'taken' | 'selected' | 'off') {
  const base = 'h-10 w-10 rounded-lg text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1';
  return {
    free: `${base} border-2 border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50`,
    taken: `${base} cursor-not-allowed bg-slate-300 text-slate-400`,
    selected: `${base} bg-blue-600 text-white shadow-md ring-2 ring-blue-300`,
    off: `${base} cursor-not-allowed border-2 border-dashed border-slate-200 bg-transparent text-slate-300`,
  }[state];
}
