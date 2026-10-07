import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense, type ReactNode } from 'react';
import { AppLayout } from '../components/AppLayout';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RequireAuth, RequirePermission } from './RequireAuth';
import { LoginPage } from '../pages/LoginPage';
import { PasswordPage } from '../pages/PasswordPage';
import { LoadingState } from '../components/LoadingState';

const MembersPage = lazy(() => import('../pages/MembersPage').then((module) => ({ default: module.MembersPage })));
const MemberDetailPage = lazy(() => import('../pages/MemberDetailPage').then((module) => ({ default: module.MemberDetailPage })));
const EventsPage = lazy(() => import('../pages/EventsPage').then((module) => ({ default: module.EventsPage })));
const EventDetailPage = lazy(() => import('../pages/EventDetailPage').then((module) => ({ default: module.EventDetailPage })));
const ArrearsPage = lazy(() => import('../pages/ArrearsPage').then((module) => ({ default: module.ArrearsPage })));
const PaymentEntryPage = lazy(() => import('../pages/PaymentEntryPage').then((module) => ({ default: module.PaymentEntryPage })));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const PaymentDetailPage = lazy(() => import('../pages/PaymentDetailPage').then((module) => ({ default: module.PaymentDetailPage })));
const ReceiptPage = lazy(() => import('../pages/ReceiptPage').then((module) => ({ default: module.ReceiptPage })));
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((module) => ({ default: module.UsersPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const allowed = (permission: string, page: ReactNode) => <RequirePermission permission={permission}><Suspense fallback={<LoadingState />}>{page}</Suspense></RequirePermission>;

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [{ element: <AppLayout />, children: [
      { index: true, element: <HomePage /> },
      { path: '/account/password', element: <PasswordPage /> },
      { path: '/members', element: allowed('members.read', <MembersPage />) },
      { path: '/members/:id', element: allowed('members.read', <MemberDetailPage />) },
      { path: '/members/:id/report', element: allowed('members.read', <ReportsPage individual />) },
      { path: '/events', element: allowed('events.manage', <EventsPage />) },
      { path: '/events/:id', element: allowed('events.manage', <EventDetailPage />) },
      { path: '/arrears', element: allowed('arrears.read', <ArrearsPage />) },
      { path: '/payments', element: allowed('payments.read', <PaymentsPage />) },
      { path: '/payments/new', element: allowed('payments.create', <PaymentEntryPage />) },
      { path: '/payments/:id', element: allowed('payments.read', <PaymentDetailPage />) },
      { path: '/payments/:id/replace', element: allowed('payments.correct', <PaymentEntryPage />) },
      { path: '/payments/:id/receipt', element: allowed('receipts.read', <ReceiptPage />) },
      { path: '/reports', element: allowed('reports.read', <ReportsPage />) },
      { path: '/users', element: allowed('users.manage', <UsersPage />) },
      { path: '/settings', element: allowed('settings.manage', <SettingsPage />) },
      { path: '*', element: <NotFoundPage /> },
    ] }],
  },
]);
