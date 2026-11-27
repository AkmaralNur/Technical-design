import axios from 'axios';
import type { ApiError } from './types';

/** Все запросы к серверу идут через этот клиент (раздел 17.6) */
export const http = axios.create({ baseURL: '/api', withCredentials: true });

type Listener = () => void;
const listeners = new Set<Listener>();

/** Событие «токен истёк» — AuthContext разлогинивает пользователя */
export const authEvents = {
  onLogout(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  emitLogout() {
    listeners.forEach((fn) => fn());
  },
};

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const apiError: ApiError = err.response?.data?.error ?? {
      code: err.response ? 'INTERNAL_ERROR' : 'NETWORK',
      message: err.response ? 'Что-то пошло не так. Попробуйте ещё раз.' : 'Нет связи с сервером. Проверьте, что сервер запущен.',
    };
    const url: string = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.startsWith('/auth/')) authEvents.emitLogout();
    return Promise.reject(apiError);
  },
);

/** Сообщение об ошибке поля из details VALIDATION_ERROR */
export function fieldErrors(e: unknown): Record<string, string> {
  const err = e as ApiError;
  if (err?.code !== 'VALIDATION_ERROR' || !Array.isArray(err.details)) return {};
  return Object.fromEntries((err.details as { field: string; message: string }[]).map((d) => [d.field, d.message]));
}

export function errorText(e: unknown): string {
  const err = e as ApiError;
  const fields = fieldErrors(e);
  const first = Object.values(fields)[0];
  return first ? `${err.message}: ${first}` : (err?.message ?? 'Ошибка');
}
