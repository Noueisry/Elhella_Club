import { useState } from 'react';
import { Alert, Box, Button, Card, Chip } from '@mui/material';
import type { ManagedUser } from '../models/administration';
import { useAuth } from '../context/auth-context';
import { useNotify } from '../context/notification-context';
import { useUsers } from '../hooks/use-administration';
import { useBusinessMutation } from '../hooks/use-business';
import { updateUser } from '../services/administration.service';
import { errorMessage } from '../services/auth.service';
import { DataTable, ListPagination, PageHeader } from '../components/BusinessUi';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { UserFormDialog } from '../components/UserFormDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
export function UsersPage() {
  const auth = useAuth(), notify = useNotify(), [page, setPage] = useState(1), [limit, setLimit] = useState(10), query = useUsers(page, limit);
  const [form, setForm] = useState<{ user?: ManagedUser; reset?: boolean }>(), [changing, setChanging] = useState<ManagedUser>();
  const activation = useBusinessMutation((user: ManagedUser) => updateUser(user.id, { isActive: !user.isActive }));
  return <>
    <PageHeader title="المستخدمون" back="/" description="إدارة الحسابات والصلاحيات دون تسجيل عام." actions={<Button variant="contained" onClick={() => setForm({})}>إضافة مستخدم</Button>} />
    <Alert severity="info" sx={{ mb: 3 }}>يجب بقاء مدير نشط واحد على الأقل. لا يمكنك تغيير صلاحيتك بنفسك. تغيير الصلاحية أو تعطيل الحساب يلغي جلساته ويحفظ سجله المالي.</Alert>
    {query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <Card>{query.data.items.length ? <DataTable label="قائمة المستخدمين" rows={query.data.items} columns={[
      { key: 'name', label: 'المستخدم', render: (row) => row.fullName }, { key: 'login', label: 'اسم الدخول', render: (row) => <bdi dir="ltr">{row.login}</bdi> }, { key: 'role', label: 'الصلاحية', render: (row) => row.role === 'admin' ? 'مدير النادي' : 'أمين الصندوق' }, { key: 'status', label: 'الحالة', render: (row) => <Chip size="small" label={row.isActive ? 'نشط' : 'معطل'} color={row.isActive ? 'success' : 'default'} /> },
      { key: 'actions', label: 'الإجراءات', render: (row) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}><Button aria-label={`تعديل المستخدم ${row.fullName}`} onClick={() => setForm({ user: row })}>تعديل</Button><Button color={row.isActive ? 'warning' : 'primary'} aria-label={`${row.isActive ? 'تعطيل' : 'تفعيل'} المستخدم ${row.fullName}`} onClick={() => setChanging(row)}>{row.isActive ? 'تعطيل' : 'تفعيل'}</Button>{row.id !== auth.user?.id && <Button aria-label={`كلمة مرور المستخدم ${row.fullName}`} onClick={() => setForm({ user: row, reset: true })}>كلمة المرور</Button>}</Box> },
    ]} /> : <EmptyState title="لا توجد حسابات" description="أضف حساباً إدارياً أو لأمين الصندوق." />}<ListPagination {...query.data} onPage={setPage} onLimit={(v) => { setLimit(v); setPage(1); }} /></Card>}
    {form && <UserFormDialog {...form} onClose={() => setForm(undefined)} />}
    {changing && <ConfirmDialog title={changing.isActive ? 'تعطيل المستخدم' : 'تفعيل المستخدم'} description={`${changing.fullName}: تُلغى الجلسات السابقة عند تغيير حالة الحساب. يمنع الخادم تعطيل آخر مدير نشط.`} onClose={() => setChanging(undefined)} onConfirm={async () => { await activation.mutateAsync(changing); notify('تم تحديث حالة المستخدم.'); if (changing.id === auth.user?.id) await auth.restore(); }} />}
  </>;
}
