import { Link } from 'react-router-dom';
import { Card, MenuItem, TextField, Typography } from '@mui/material';
import type { ArrearsQuery, MemberStatus } from '../models/business';
import { useArrears } from '../hooks/use-business';
import { useListFilters } from '../hooks/use-list-filters';
import { useDebounced } from '../hooks/use-debounced';
import { errorMessage } from '../services/auth.service';
import { civilDate } from '../utils/business-format';
import { DataTable, ListPagination, MemberBadge, Metrics, Money, PageHeader, PaymentLink } from '../components/BusinessUi';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';

export function ArrearsPage() {
  const filters = useListFilters(), search = filters.params.get('search') ?? '', debounced = useDebounced(search);
  const rawStatus = filters.params.get('status'), status = rawStatus === 'active' || rawStatus === 'inactive' ? rawStatus as MemberStatus : '';
  const rawCategory = filters.params.get('category'), category: ArrearsQuery['category'] = rawCategory === 'monthly' || rawCategory === 'event' ? rawCategory : 'all';
  const query = useArrears({ search: debounced || undefined, status: status || undefined, category, page: filters.page, limit: filters.limit });
  const waiting = search.trim() !== debounced;
  return <>
    <PageHeader title="المتأخرات" description="الديون المستحقة غير المسددة، مرتبة من أكبر مبلغ إلى أصغره. يشمل غير النشطين والمؤرشفين." actions={<PaymentLink />} />
    <Card sx={{ p: 2.5, mb: 3 }} className="filter-bar">
      <TextField label="البحث عن منتسب" value={search} placeholder="الاسم أو رقم العضوية أو الهاتف" onChange={(event) => filters.set('search', event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: '2 1 250px' }} />
      <TextField select label="حالة النشاط" value={status} onChange={(event) => filters.set('status', event.target.value)} sx={{ flex: '1 1 150px' }}><MenuItem value="">جميع الحالات</MenuItem><MenuItem value="active">نشط</MenuItem><MenuItem value="inactive">غير نشط</MenuItem></TextField>
      <TextField select label="نوع المتأخرات" value={category} onChange={(event) => filters.set('category', event.target.value)} sx={{ flex: '1 1 180px' }}><MenuItem value="all">كل المتأخرات</MenuItem><MenuItem value="monthly">لديهم متأخرات شهرية</MenuItem><MenuItem value="event">لديهم متأخرات دورات</MenuItem></TextField>
    </Card>
    {waiting || query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>حتى <bdi>{civilDate(query.data.asOf)}</bdi>. المجاميع لجميع نتائج المرشحات، لا للصفحة فقط. مرشح النوع يختار المنتسبين ويُبقي كامل ديونهم ظاهرة.</Typography>
      <Metrics items={[{ label: 'المتأخرات الشهرية', value: query.data.totals.monthlyArrears }, { label: 'متأخرات الدورات', value: query.data.totals.eventArrears }, { label: 'إجمالي المتأخرات', value: query.data.totals.totalArrears }]} />
      <Card>{query.data.items.length ? <DataTable label="قائمة المتأخرات" rows={query.data.items} columns={[
        { key: 'member', label: 'المنتسب', render: (member) => <><Link className="record-link" to={`/members/${member.id}`}>{member.fullName}</Link><Typography variant="body2" color="text.secondary"><bdi dir="ltr">{member.membershipNumber}</bdi></Typography></> },
        { key: 'status', label: 'الحالة', render: (member) => <MemberBadge member={member} /> },
        { key: 'monthly', label: 'المتأخر الشهري', render: (member) => <Money value={member.monthlyArrears} /> },
        { key: 'event', label: 'متأخر الدورات', render: (member) => <Money value={member.eventArrears} /> },
        { key: 'total', label: 'الإجمالي', render: (member) => <Money value={member.arrears} /> },
        { key: 'payment', label: 'الإجراء', render: (member) => <PaymentLink memberId={member.id} compact /> },
      ]} /> : <EmptyState title="لا توجد متأخرات بهذه المرشحات" description="غيّر البحث أو نوع المتأخرات أو حالة النشاط." />}
        <ListPagination {...query.data} onPage={(value) => filters.set('page', String(value))} onLimit={(value) => filters.set('limit', String(value))} />
      </Card>
    </>}
  </>;
}
