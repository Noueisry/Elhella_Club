import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, Card, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import type { MemberQuery, MemberStatus } from '../models/business';
import { useAuth } from '../context/auth-context';
import { useMembers } from '../hooks/use-business';
import { useDebounced } from '../hooks/use-debounced';
import { useListFilters } from '../hooks/use-list-filters';
import { errorMessage } from '../services/auth.service';
import { civilDate } from '../utils/business-format';
import { DataTable, ListPagination, MemberBadge, PageHeader, PaymentLink } from '../components/BusinessUi';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { MemberActions } from '../components/MemberActions';
import { MemberFormDialog } from '../components/MemberFormDialog';

export function MembersPage() {
  const { user } = useAuth(), navigate = useNavigate(), filters = useListFilters();
  const [creating, setCreating] = useState(false);
  const search = filters.params.get('search') ?? '', debounced = useDebounced(search);
  const rawStatus = filters.params.get('status'), status = rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus as MemberStatus : '';
  const rawArchived = filters.params.get('archived'), archived: MemberQuery['archived'] = rawArchived === 'include' || rawArchived === 'only' ? rawArchived : 'exclude';
  const query = useMembers({ search: debounced || undefined, status: status || undefined, archived, page: filters.page, limit: filters.limit });
  const waiting = search.trim() !== debounced;
  return <>
    <PageHeader title="المنتسبون" description="ابحث بالاسم أو رقم العضوية أو الهاتف، ثم افتح كشف الحساب." actions={<><PaymentLink />{user?.permissions.includes('members.manage') && <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setCreating(true)}>إضافة منتسب</Button>}</>} />
    <Card>
      <Box className="filter-bar" sx={{ p: 2.5 }}>
        <TextField label="ابحث عن اسم المنتسب" value={search} onChange={(event) => filters.set('search', event.target.value)} placeholder="الاسم أو رقم العضوية أو الهاتف" slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: '2 1 260px' }} />
        <TextField select label="حالة النشاط" value={status} onChange={(event) => filters.set('status', event.target.value)} sx={{ flex: '1 1 150px' }}><MenuItem value="">جميع الحالات</MenuItem><MenuItem value="active">نشط</MenuItem><MenuItem value="inactive">غير نشط</MenuItem></TextField>
        <TextField select label="الأرشيف" value={archived} onChange={(event) => filters.set('archived', event.target.value)} sx={{ flex: '1 1 170px' }}><MenuItem value="exclude">الملفات الحالية</MenuItem><MenuItem value="include">الحالية والمؤرشفة</MenuItem><MenuItem value="only">المؤرشفة فقط</MenuItem></TextField>
      </Box>
      {waiting || query.isPending ? <LoadingState label="جارٍ البحث عن المنتسبين…" /> : query.isError ? <Box sx={{ p: 2 }}><ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /></Box> : <>
        {query.data.items.length ? <DataTable label="قائمة المنتسبين" rows={query.data.items} columns={[
          { key: 'name', label: 'المنتسب', render: (member) => <Link className="record-link" to={`/members/${member.id}`}>{member.fullName}</Link> },
          { key: 'number', label: 'رقم العضوية', render: (member) => <bdi dir="ltr">{member.membershipNumber}</bdi> },
          { key: 'phone', label: 'الهاتف', render: (member) => <bdi dir="ltr">{member.phone}</bdi> },
          { key: 'joined', label: 'تاريخ الانضمام', render: (member) => <bdi>{civilDate(member.joinedOn)}</bdi> },
          { key: 'status', label: 'الحالة', render: (member) => <MemberBadge member={member} /> },
          { key: 'actions', label: 'الإجراءات', render: (member) => <MemberActions member={member} /> },
        ]} /> : <EmptyState title="لا توجد نتائج" description="غيّر البحث أو مرشحات النشاط والأرشيف." />}
        <ListPagination page={query.data.page} limit={query.data.limit} total={query.data.total} onPage={(value) => filters.set('page', String(value))} onLimit={(value) => filters.set('limit', String(value))} />
      </>}
    </Card>
    {creating && <MemberFormDialog onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); void navigate(`/members/${id}`); }} />}
  </>;
}
