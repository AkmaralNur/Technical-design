import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api';
import { fieldErrors } from '../api/client';
import type { ApiError } from '../api/types';
import { Container } from '../components/Layout';
import { Alert, Badge, Button, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fmtDateTime } from '../utils/format';

function useAfterLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');
  return (role: string) => navigate(next && next.startsWith('/') ? next : role === 'ADMIN' ? '/admin' : '/', { replace: true });
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <Container className="flex max-w-md flex-col justify-center py-12">
      <div className="card p-6 sm:p-8">
        <div className="mb-6 text-center">
          <img src="/train.svg" alt="" className="mx-auto mb-3 h-12 w-12 rounded-xl" />
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </Container>
  );
}

// ---------------------------------------------------------------- вход

const loginSchema = z.object({
  email: z.string().trim().email('Неверный формат email'),
  password: z.string().min(1, 'Введите пароль'),
});

export function LoginPage() {
  const { user, setUser } = useAuth();
  const after = useAfterLogin();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  if (user && !formState.isSubmitting) return <Navigate to={params.get('next') ?? '/'} replace />;

  const onSubmit = handleSubmit(async (data) => {
    setError(null);
    try {
      const u = await api.login(data);
      setUser(u);
      after(u.role);
    } catch (e) {
      setError((e as ApiError).message);
    }
  });

  return (
    <AuthCard title="Вход" subtitle={<>Нет аккаунта? <Link to={`/register${location.search}`} className="font-semibold text-blue-600 hover:underline">Зарегистрируйтесь</Link></>}>
      {params.get('next') === '/booking/review' && (
        <div className="mb-4">
          <Alert>Войдите, чтобы подтвердить бронирование — выбранное место сохранено.</Alert>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={formState.errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register('email')} />
        </Field>
        <Field label="Пароль" error={formState.errors.password?.message}>
          <input type="password" autoComplete="current-password" className="input" {...register('password')} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" className="w-full py-2.5" loading={formState.isSubmitting}>
          Войти
        </Button>
      </form>
      <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <b>Тестовые аккаунты:</b>
        <br />
        пассажир — anna@example.com / secret123
        <br />
        админ — admin@traintix.local / Admin12345
      </div>
    </AuthCard>
  );
}

// ---------------------------------------------------------------- регистрация

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Имя — от 2 до 100 символов').max(100, 'Имя — от 2 до 100 символов'),
    email: z.string().trim().email('Неверный формат email'),
    password: z.string().min(8, 'Минимум 8 символов').regex(/[A-Za-zА-Яа-яЁё]/, 'Нужна хотя бы одна буква').regex(/\d/, 'Нужна хотя бы одна цифра'),
    password2: z.string(),
  })
  .refine((v) => v.password === v.password2, { message: 'Пароли не совпадают', path: ['password2'] });

export function RegisterPage() {
  const { user, setUser } = useAuth();
  const after = useAfterLogin();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  if (user && !formState.isSubmitting) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setError(null);
    try {
      const u = await api.register({ name, email, password });
      setUser(u);
      after(u.role);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'EMAIL_TAKEN') setFieldError('email', { message: err.message });
      else {
        const fields = fieldErrors(e);
        Object.entries(fields).forEach(([f, m]) => setFieldError(f as 'name', { message: m }));
        if (!Object.keys(fields).length) setError(err.message);
      }
    }
  });

  return (
    <AuthCard title="Регистрация" subtitle={<>Уже есть аккаунт? <Link to={`/login${location.search}`} className="font-semibold text-blue-600 hover:underline">Войдите</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Имя и фамилия" error={formState.errors.name?.message}>
          <input autoComplete="name" className="input" {...register('name')} />
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          <input type="email" autoComplete="email" className="input" {...register('email')} />
        </Field>
        <Field label="Пароль" error={formState.errors.password?.message} hint="Минимум 8 символов, буква и цифра">
          <input type="password" autoComplete="new-password" className="input" {...register('password')} />
        </Field>
        <Field label="Повторите пароль" error={formState.errors.password2?.message}>
          <input type="password" autoComplete="new-password" className="input" {...register('password2')} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" className="w-full py-2.5" loading={formState.isSubmitting}>
          Создать аккаунт
        </Button>
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------- аккаунт

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <Container className="max-w-xl">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">{user.name[0]?.toUpperCase()}</div>
          <div>
            <h1 className="text-xl font-bold">{user.name}</h1>
            <Badge color={user.role === 'ADMIN' ? 'violet' : 'blue'}>{user.role === 'ADMIN' ? 'Администратор' : 'Пассажир'}</Badge>
          </div>
        </div>
        <dl className="mt-6 divide-y divide-slate-100 text-sm">
          <div className="flex justify-between py-3">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between py-3">
            <dt className="text-slate-500">Дата регистрации</dt>
            <dd className="font-medium">{fmtDateTime(user.createdAt)}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          {user.role === 'PASSENGER' && (
            <Link to="/tickets" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Мои билеты
            </Link>
          )}
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Админка
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    </Container>
  );
}

export function NotFoundPage() {
  return (
    <Container className="py-20 text-center">
      <div className="text-6xl">🛤️</div>
      <h1 className="mt-4 text-2xl font-bold">Страница не найдена</h1>
      <p className="mt-2 text-slate-500">Похоже, этот поезд сюда не ходит.</p>
      <Link to="/" className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        На главную
      </Link>
    </Container>
  );
}
