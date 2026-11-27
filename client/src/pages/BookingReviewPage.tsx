import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { bookTicket } from '../api';
import type { ApiError, Money } from '../api/types';
import { Container } from '../components/Layout';
import { Alert, Button, ClassBadge, EmptyState, PageTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { clearSelection, loadSelection, saveSelection } from '../utils/booking';
import { fmtDate, fmtTime } from '../utils/format';

/** Проверка брони: рейс, место и цена перед подтверждением (FR-14) */
export function BookingReviewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sel, setSel] = useState(loadSelection);
  const [newPrice, setNewPrice] = useState<Money | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const book = useMutation({
    mutationFn: bookTicket,
    onSuccess: (ticket) => {
      clearSelection();
      qc.invalidateQueries({ queryKey: ['tickets'] });
      qc.invalidateQueries({ queryKey: ['seats'] });
      qc.invalidateQueries({ queryKey: ['search'] });
      toast('Билет забронирован! Подтверждение отправлено на email.', 'success');
      navigate(`/tickets/${ticket.id}`, { replace: true });
    },
    onError: (e: ApiError) => {
      if (e.code === 'SEAT_UNAVAILABLE') {
        toast(e.message, 'error');
        qc.invalidateQueries({ queryKey: ['seats'] });
        navigate(`/trips/${sel!.tripId}?from=${sel!.fromStopOrder}&to=${sel!.toStopOrder}`, { replace: true });
        return;
      }
      if (e.code === 'PRICE_CHANGED') {
        setNewPrice((e.details as { newPrice: Money }).newPrice);
        return;
      }
      setError(e);
    },
  });

  if (!sel) {
    return (
      <Container>
        <EmptyState icon="🎫" title="Место не выбрано" text="Найдите поезд и выберите место на схеме вагона." action={<Link to="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">К поиску</Link>} />
      </Container>
    );
  }

  const confirm = (price: string) => {
    setError(null);
    book.mutate({ tripId: sel.tripId, seatId: sel.seatId, fromStopOrder: sel.fromStopOrder, toStopOrder: sel.toStopOrder, expectedPrice: price });
  };

  const acceptNewPrice = () => {
    if (!newPrice) return;
    const updated = { ...sel, price: newPrice.amount, currency: newPrice.currency };
    saveSelection(updated);
    setSel(updated);
    setNewPrice(null);
    confirm(newPrice.amount);
  };

  return (
    <Container className="max-w-3xl">
      <PageTitle title="Проверка брони" subtitle="Проверьте данные и подтвердите бронирование" back={{ to: `/trips/${sel.tripId}?from=${sel.fromStopOrder}&to=${sel.toStopOrder}`, label: 'Изменить место' }} />

      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-4 text-white">
          <div className="text-sm opacity-80">Поезд {sel.trainNumber}{sel.trainName ? ` · ${sel.trainName}` : ''}</div>
          <div className="text-xl font-bold">{fmtDate(sel.departureAt, sel.fromTz)}</div>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <div className="label">Отправление</div>
            <div className="text-2xl font-bold">{fmtTime(sel.departureAt, sel.fromTz)}</div>
            <div className="text-slate-600">{sel.fromName}</div>
          </div>
          <div>
            <div className="label">Прибытие</div>
            <div className="text-2xl font-bold">{fmtTime(sel.arrivalAt, sel.toTz)}</div>
            <div className="text-slate-600">{sel.toName}</div>
          </div>
          <div>
            <div className="label">Пассажир</div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-slate-500">{user?.email}</div>
          </div>
          <div>
            <div className="label">Место</div>
            <div className="flex items-center gap-2 font-semibold">
              Вагон {sel.carriageNo}, место {sel.seatLabel} <ClassBadge seatClass={sel.seatClass} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <div className="label">Итого к оплате</div>
            <div className="text-3xl font-extrabold text-blue-700">
              {sel.price} {sel.currency}
            </div>
            <div className="text-xs text-slate-500">Оплата не требуется — бронь подтверждается сразу</div>
          </div>
          <Button onClick={() => confirm(sel.price)} loading={book.isPending} disabled={!!newPrice || user?.role === 'ADMIN'} className="px-8 py-3 text-base">
            Подтвердить бронирование
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {user?.role === 'ADMIN' && <Alert kind="warning">Администратор не может бронировать билеты. Войдите как пассажир.</Alert>}
        {newPrice && (
          <Alert kind="warning">
            <p className="font-semibold">Цена изменилась: теперь {newPrice.amount} {newPrice.currency} (было {sel.price} {sel.currency}).</p>
            <Button className="mt-3" onClick={acceptNewPrice} loading={book.isPending}>
              Подтвердить с новой ценой
            </Button>
          </Alert>
        )}
        {error && <Alert kind="error">{error.message}</Alert>}
      </div>
    </Container>
  );
}
