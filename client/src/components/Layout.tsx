import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBoundary } from './ErrorBoundary';

function NavItem({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
      }
    >
      {children}
    </NavLink>
  );
}

/** Шапка: меню зависит от роли (раздел 17.4) */
function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = (
    <>
      <NavItem to="/" onClick={close}>
        Поиск
      </NavItem>
      {user?.role === 'PASSENGER' && (
        <NavItem to="/tickets" onClick={close}>
          Мои билеты
        </NavItem>
      )}
      {user?.role === 'ADMIN' && (
        <NavItem to="/admin" onClick={close}>
          Админка
        </NavItem>
      )}
      {user ? (
        <>
          <NavItem to="/account" onClick={close}>
            👤 {user.name.split(' ')[0]}
          </NavItem>
          <button
            onClick={async () => {
              close();
              await logout();
              navigate('/');
            }}
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-100 hover:bg-white/10 hover:text-white"
          >
            Выйти
          </button>
        </>
      ) : (
        <>
          <NavItem to="/login" onClick={close}>
            Войти
          </NavItem>
          <Link to="/register" onClick={close} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            Регистрация
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-800 to-blue-600 shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-white" onClick={close}>
          <img src="/train.svg" alt="" className="h-8 w-8 rounded-lg ring-2 ring-white/30" />
          <span className="text-xl font-extrabold tracking-tight">TrainTix</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">{links}</nav>
        <button className="rounded-lg p-2 text-white hover:bg-white/10 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Меню" aria-expanded={open}>
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open && <nav className="flex flex-col gap-1 border-t border-white/10 px-4 pb-4 pt-2 md:hidden">{links}</nav>}
    </header>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        TrainTix © {new Date().getFullYear()} · Бронирование билетов на поезд · Время указано местное для каждой станции
      </footer>
    </div>
  );
}

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-6 sm:py-8 ${className}`}>{children}</div>;
}
