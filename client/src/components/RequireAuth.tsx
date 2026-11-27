import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, PageSpinner } from './ui';
import { Container } from './Layout';

/** Не пускает на страницу без входа: переход на вход, потом обратно */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

/** Только для администратора */
export function RequireAdmin() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'ADMIN') {
    return (
      <Container>
        <EmptyState icon="🔒" title="Нет доступа" text="У вас нет доступа к этой странице" />
      </Container>
    );
  }
  return <Outlet />;
}
