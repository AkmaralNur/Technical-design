import type { TripStop } from '../api/types';
import { fmtTime } from '../utils/format';

/** Все остановки по порядку, свой участок выделен цветом */
export function StopsTimeline({ stops, from, to }: { stops: TripStop[]; from?: number; to?: number }) {
  return (
    <ol className="relative">
      {stops.map((s, i) => {
        const inJourney = from !== undefined && to !== undefined && s.stopOrder >= from && s.stopOrder <= to;
        const segmentActive = from !== undefined && to !== undefined && s.stopOrder >= from && s.stopOrder < to;
        const isFrom = s.stopOrder === from;
        const isTo = s.stopOrder === to;
        return (
          <li key={s.stopOrder} className="relative flex gap-4 pb-5 last:pb-0">
            {i < stops.length - 1 && (
              <span className={`absolute left-[9px] top-5 h-full w-0.5 ${segmentActive ? 'bg-blue-600' : 'border-l-2 border-dashed border-slate-300 bg-transparent'}`} />
            )}
            <span
              className={`relative z-10 mt-0.5 h-5 w-5 shrink-0 rounded-full border-4 ${
                inJourney ? 'border-blue-600 bg-white' : 'border-slate-300 bg-white'
              } ${isFrom || isTo ? 'bg-blue-600!' : ''}`}
            />
            <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4">
              <div>
                <span className={`font-semibold ${inJourney ? 'text-slate-900' : 'text-slate-500'}`}>{s.name}</span>
                {isFrom && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">посадка</span>}
                {isTo && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">выход</span>}
              </div>
              <div className="text-sm tabular-nums text-slate-600">
                {s.arrivalAt && <span>приб. {fmtTime(s.arrivalAt, s.timezone)}</span>}
                {s.arrivalAt && s.departureAt && <span className="mx-1 text-slate-300">·</span>}
                {s.departureAt && <span className={isFrom ? 'font-semibold text-slate-900' : ''}>отпр. {fmtTime(s.departureAt, s.timezone)}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
