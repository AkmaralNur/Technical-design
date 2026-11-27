import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { cancelTicket, getTicket, ticketPdfUrl } from '../api';
import type { ApiError } from '../api/types';
import { Container } from '../components/Layout';
import { Alert, Badge, Button, ClassBadge, ConfirmDialog, EmptyState, PageSpinner, PageTitle, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { fmtDate, fmtDateTime, fmtDuration, fmtMoney, fmtTime } from '../utils/format';

/** Полный билет + «Скачать PDF» + «Отменить» */
export function TicketDetailsPage() {
  const { id } = useParams();
  const ticketId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const ticket = useQuery({ queryKey: ['tickets', 'one', ticketId], queryFn: () => getTicket(ticketId), retry: false });

  const cancel = useMutation({
    mutationFn: () => cancelTicket(ticketId),
    onSuccess: (t) => {
      qc.setQueryData(['tickets', 'one', ticketId], t);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['seats'] });
      setConfirming(false);
      toast('Билет отменён. Место снова свободно.', 'success');
    },
    onError: (e: ApiError) => {
      setConfirming(false);
      toast(e.message, 'error');
      qc.invalidateQueries({ queryKey: ['tickets', 'one', ticketId] });
    },
  });

  if (ticket.isLoading) return <PageSpinner />;
  if (ticket.isError || !ticket.data) {
    return (
      <Container>
        <EmptyState icon="🔍" title="Билет не найден" text="Возможно, ссылка неверная или билет принадлежит другому пассажиру." action={<Link to="/tickets" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Мои билеты</Link>} />
      </Container>
    );
  }
  const t = ticket.data;
  const duration = Math.round((new Date(t.to.arrivalAt).getTime() - new Date(t.from.departureAt).getTime()) / 60000);

  return (
    <Container className="max-w-3xl">
      <PageTitle title="Билет" back={{ to: '/tickets', label: 'Мои билеты' }} />

      <div className="mb-4 space-y-3">
        {t.trip.status === 'CANCELLED' && (
          <Alert kind="error">
            <b>Рейс отменён перевозчиком.</b> {t.trip.cancelReason && <>Причина: {t.trip.cancelReason}.</>} Билет автоматически отменён.
          </Alert>
        )}
        {t.trip.scheduleChanged && t.status === 'CONFIRMED' && <Alert kind="warning">⚠️ Расписание изменено. Ниже — актуальное время отправления и прибытия.</Alert>}
      </div>

      <article className={`card overflow-hidden ${t.status === 'CANCELLED' ? 'opacity-80' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-4 text-white">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-75">Билет</div>
            <div className="font-mono text-xl font-bold">{t.ticketNumber}</div>
          </div>
          <StatusBadge status={t.displayStatus} />
        </div>

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="label">Пассажир</div>
              <div className="font-semibold">{t.passengerName}</div>
            </div>
            <div>
              <div className="label">Поезд</div>
              <div className="font-semibold">{t.trainNumber}</div>
            </div>
            <div>
              <div className="label">Дата</div>
              <div className="font-semibold">{fmtDate(t.from.departureAt, t.from.timezone)}</div>
            </div>
          </div>

          <div className="my-6 flex items-center gap-3 rounded-xl bg-slate-50 p-4">
            <div>
              <div className="text-3xl font-extrabold tabular-nums">{fmtTime(t.from.departureAt, t.from.timezone)}</div>
              <div className="font-medium text-slate-600">{t.from.name}</div>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <span className="text-xs text-slate-500">{fmtDuration(duration)}</span>
              <div className="my-1 h-0.5 w-full bg-blue-300" />
              <span className="text-blue-600">🚆</span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold tabular-nums">{fmtTime(t.to.arrivalAt, t.to.timezone)}</div>
              <div className="font-medium text-slate-600">{t.to.name}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <div className="label">Вагон</div>
              <div className="text-lg font-bold">{t.seat.carriageNo}</div>
            </div>
            <div>
              <div className="label">Место</div>
              <div className="text-lg font-bold">{t.seat.label}</div>
            </div>
            <div>
              <div className="label">Класс</div>
              <ClassBadge seatClass={t.seat.seatClass} />
            </div>
            <div>
              <div className="label">Цена</div>
              <div className="text-lg font-bold text-blue-700">{fmtMoney(t.price)}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>Куплен: {fmtDateTime(t.createdAt)}</span>
            {t.cancelledAt && (
              <span>
                Отменён: {fmtDateTime(t.cancelledAt)} {t.cancelledBy === 'ADMIN' ? <Badge color="red">перевозчиком</Badge> : '(вами)'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <a href={ticketPdfUrl(t.id)} download className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            ⬇ Скачать PDF
          </a>
          {t.canCancel && (
            <Button variant="danger" onClick={() => setConfirming(true)}>
              Отменить билет
            </Button>
          )}
        </div>
      </article>

      {t.displayStatus === 'COMPLETED' && <p className="mt-3 text-center text-sm text-slate-500">Поезд уже отправился — отменить билет нельзя.</p>}

      {confirming && (
        <ConfirmDialog
          title="Отменить билет?"
          text={
            <>
              Билет <b>{t.ticketNumber}</b> ({t.from.name} → {t.to.name}, {fmtDate(t.from.departureAt, t.from.timezone)}) будет отменён, а место {t.seat.label} станет свободным. Это действие нельзя отменить.
            </>
          }
          confirmText="Да, отменить билет"
          danger
          loading={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </Container>
  );
}
