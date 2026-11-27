import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import { authEvents } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Кто вошёл — загружается через GET /api/auth/me при открытии сайта (раздел 17.5) */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe().catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const setUser = (u: User | null) => {
    qc.setQueryData(['me'], u);
    if (!u) qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'stations' });
  };

  useEffect(() => authEvents.onLogout(() => setUser(null)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user: me.data ?? null, loading: me.isLoading, setUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
