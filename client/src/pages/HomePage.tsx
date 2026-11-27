import { Link } from 'react-router-dom';
import { SearchForm } from '../components/SearchForm';
import { useStations } from '../hooks/useStations';
import { addDaysIso, todayIso } from '../utils/format';

const POPULAR: [string, string][] = [
  ['PRG', 'BRN'],
  ['PRG', 'VIE'],
  ['BRN', 'VIE'],
  ['VIE', 'PRG'],
  ['OST', 'BTS'],
];

export function HomePage() {
  const stations = useStations();
  const byCode = new Map((stations.data ?? []).map((s) => [s.code, s]));
  const tomorrow = addDaysIso(todayIso(), 1);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 pb-28 pt-12 sm:pt-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-indigo-400/30 blur-2xl" />
        <div className="relative mx-auto max-w-6xl px-4 text-white">
          <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">Билеты на поезд — за минуту</h1>
          <p className="mt-3 max-w-xl text-blue-100 sm:text-lg">
            Найдите поезд, выберите место на схеме вагона и получите билет на email. Без оплаты — бронь подтверждается сразу.
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-20 max-w-6xl px-4">
        <div className="card p-5 shadow-xl sm:p-6">
          <SearchForm />
        </div>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Популярные направления на завтра</h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR.map(([a, b]) => {
              const from = byCode.get(a);
              const to = byCode.get(b);
              if (!from || !to) return null;
              return (
                <Link
                  key={a + b}
                  to={`/search?from=${from.id}&to=${to.id}&date=${tomorrow}`}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-blue-400 hover:text-blue-700"
                >
                  {from.name} → {to.name}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mb-16 mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['💺', 'Место на схеме', 'Выбирайте конкретное место в вагоне Эконом или Бизнес — видно, что свободно именно на вашем участке.'],
            ['📄', 'Билет в PDF', 'После брони билет с QR-кодом можно скачать, а подтверждение придёт на email.'],
            ['↩️', 'Отмена онлайн', 'Планы изменились? Отмените билет в пару кликов до отправления поезда.'],
          ].map(([icon, title, text]) => (
            <div key={title} className="card p-5">
              <div className="text-3xl">{icon}</div>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
