import { Navigate } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { useAuth } from '../context/auth-context';

export function HomePage() {
  const { user } = useAuth();
  return user?.permissions.includes('dashboard.read') ? <DashboardPage /> : <Navigate to="/members" replace />;
}
