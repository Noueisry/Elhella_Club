import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { ForbiddenPage } from '../pages/ForbiddenPage';

export function RequireAuth() {
  const auth = useAuth(), location = useLocation();
  if (auth.status === 'loading') return <LoadingState />;
  if (auth.status === 'error') return <ErrorState message={auth.error} onRetry={() => { void auth.restore(); }} />;
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  return user?.permissions.includes(permission) ? children : <ForbiddenPage />;
}
