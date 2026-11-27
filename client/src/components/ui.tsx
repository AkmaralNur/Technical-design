import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Ticket } from '../api/types';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({
  variant = 'primary',
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${small ? 'h-4 w-4' : 'h-8 w-8 text-blue-600'}`}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-20">
      <Spinner />
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = (error as { message?: string })?.message ?? 'Что-то пошло не так';
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Повторить
        </button>
      )}
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'warning' | 'error' | 'success'; children: ReactNode }) {
  const cls = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[kind];
  return <div className={`rounded-xl border p-4 text-sm ${cls}`}>{children}</div>;
}

export function EmptyState({ icon = '🚆', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-5xl">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Badge({ color = 'slate', children }: { color?: 'slate' | 'green' | 'red' | 'blue' | 'amber' | 'violet'; children: ReactNode }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
    violet: 'bg-violet-100 text-violet-800',
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

/** «Предстоящий» / «Завершён» / «Отменён» */
export function StatusBadge({ status }: { status: Ticket['displayStatus'] }) {
  if (status === 'UPCOMING') return <Badge color="green">✓ Предстоящий</Badge>;
  if (status === 'COMPLETED') return <Badge color="slate">Завершён</Badge>;
  return <Badge color="red">Отменён</Badge>;
}

export function ClassBadge({ seatClass }: { seatClass: 'ECONOMY' | 'BUSINESS' }) {
  return seatClass === 'BUSINESS' ? <Badge color="violet">Бизнес</Badge> : <Badge color="blue">Эконом</Badge>;
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** «Вы уверены?» */
export function ConfirmDialog({
  title,
  text,
  confirmText = 'Подтвердить',
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  title: string;
  text: ReactNode;
  confirmText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Назад
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{text}</div>
    </Modal>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-500">
        Стр. {page} из {pages} · всего {total}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Назад
        </Button>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Вперёд →
        </Button>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode }) {
  return (
    <div className="mb-6">
      {back &&
        (back.to === 'back' ? (
          <button onClick={() => history.back()} className="mb-2 inline-block text-sm font-medium text-blue-600 hover:underline">
            ← {back.label}
          </button>
        ) : (
          <Link to={back.to} className="mb-2 inline-block text-sm font-medium text-blue-600 hover:underline">
            ← {back.label}
          </Link>
        ))}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
