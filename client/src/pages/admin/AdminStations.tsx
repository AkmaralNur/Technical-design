import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { admin } from '../../api';
import { errorText } from '../../api/client';
import type { Station } from '../../api/types';
import { Badge, Button, ErrorMessage, Field, PageSpinner, PageTitle } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const TZ = ['Europe/Prague', 'Europe/Vienna', 'Europe/Bratislava', 'Europe/Berlin', 'Europe/Warsaw', 'Europe/Budapest', 'Asia/Almaty', 'Europe/Moscow'];

const empty = { code: '', name: '', city: '', timezone: 'Europe/Prague' };

export function AdminStations() {
  const qc = useQueryClient();
  const toast = useToast();
  const stations = useQuery({ queryKey: ['admin', 'stations'], queryFn: admin.stations });
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState(empty);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'stations'] });
    qc.invalidateQueries({ queryKey: ['stations'] });
  };
  const create = useMutation({
    mutationFn: () => admin.createStation(form),
    onSuccess: () => {
      toast('Станция добавлена', 'success');
      setForm(empty);
      refresh();
    },
    onError: (e) => toast(errorText(e), 'error'),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => admin.updateStation(id, body),
    onSuccess: () => {
      setEditId(null);
      refresh();
      toast('Сохранено', 'success');
    },
    onError: (e) => toast(errorText(e), 'error'),
  });

  return (
    <>
      <PageTitle title="Станции" subtitle="Станции используются в маршрутах и поиске. Удалять нельзя — только выключать." />

      <form
        className="card mb-6 grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[120px_1fr_1fr_200px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Код">
          <input className="input uppercase" placeholder="PRG" maxLength={10} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        </Field>
        <Field label="Название">
          <input className="input" placeholder="Prague" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Город">
          <input className="input" placeholder="Prague" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Часовой пояс">
          <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {TZ.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Button type="submit" loading={create.isPending}>
          + Добавить
        </Button>
      </form>

      {stations.isLoading && <PageSpinner />}
      {stations.isError && <ErrorMessage error={stations.error} />}
      {stations.data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Название</th>
                <th>Город</th>
                <th>Часовой пояс</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stations.data.map((s: Station) =>
                editId === s.id ? (
                  <tr key={s.id} className="bg-blue-50/50">
                    <td>
                      <input className="input w-24 uppercase" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
                    </td>
                    <td>
                      <select className="input" value={edit.timezone} onChange={(e) => setEdit({ ...edit, timezone: e.target.value })}>
                        {[...new Set([edit.timezone, ...TZ])].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td />
                    <td className="whitespace-nowrap text-right">
                      <Button className="mr-1" loading={update.isPending} onClick={() => update.mutate({ id: s.id, body: edit })}>
                        Сохранить
                      </Button>
                      <Button variant="ghost" onClick={() => setEditId(null)}>
                        Отмена
                      </Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className={s.isActive ? '' : 'text-slate-400'}>
                    <td className="font-mono font-semibold">{s.code}</td>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.city ?? '—'}</td>
                    <td className="text-slate-500">{s.timezone}</td>
                    <td>{s.isActive ? <Badge color="green">Активна</Badge> : <Badge>Выключена</Badge>}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditId(s.id);
                          setEdit({ code: s.code, name: s.name, city: s.city ?? '', timezone: s.timezone });
                        }}
                      >
                        Изменить
                      </Button>
                      <Button variant="ghost" onClick={() => update.mutate({ id: s.id, body: { isActive: !s.isActive } })}>
                        {s.isActive ? 'Выключить' : 'Включить'}
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
