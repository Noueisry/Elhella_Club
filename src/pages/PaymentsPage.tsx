import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { usePayments } from '../hooks/use-payments';
import { useListFilters } from '../hooks/use-list-filters';
import { useDebounced } from '../hooks/use-debounced';
import type { PaymentQuery } from '../models/payment';
import { categoryLabels, civilDate, methodLabels } from '../utils/business-format';
import { errorMessage } from '../services/auth.service';
import { DataTable, ListPagination, Money, PageHeader, PaymentLink } from '../components/BusinessUi';
import { PaymentMemberSelect } from '../components/PaymentMemberSelect';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
export function PaymentsPage() {
  const filters = useListFilters(), [pickMember, setPickMember] = useState(false), search = filters.params.get('search') ?? '', debounced = useDebounced(search);
  const category = filters.params.get('category') ?? '', method = filters.params.get('method') ?? '', status = filters.params.get('status') ?? '', memberId = filters.params.get('memberId') ?? '';
  const query = usePayments({ page: filters.page, limit: filters.limit, search: debounced || undefined, memberId: memberId || undefined,
    from: filters.params.get('from') || undefined, to: filters.params.get('to') || undefined,
    category: Object.keys(categoryLabels).includes(category) ? category as PaymentQuery['category'] : undefined,
    method: Object.keys(methodLabels).includes(method) ? method as PaymentQuery['method'] : undefined, status: status === 'posted' || status === 'cancelled' ? status : undefined });
  return <>
    <PageHeader title="الدفعات" description="الدفعات المسجلة وإيصالاتها، مع إبقاء السجلات الملغاة محفوظة." actions={<PaymentLink />} />
    <Card sx={{ p: 2.5, mb: 3 }}><div className="filter-bar">
      <TextField label="البحث في الدفعات" placeholder="الاسم أو رقم العضوية أو الهاتف أو الإيصال" value={search} onChange={(event) => filters.set('search', event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: '2 1 250px' }} />
      <TextField select label="نوع الدفعة" value={category} onChange={(event) => filters.set('category', event.target.value)} sx={{ flex: '1 1 170px' }}><MenuItem value="">جميع الأنواع</MenuItem>{Object.entries(categoryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField select label="طريقة الدفع" value={method} onChange={(event) => filters.set('method', event.target.value)} sx={{ flex: '1 1 150px' }}><MenuItem value="">جميع الوسائل</MenuItem>{Object.entries(methodLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField select label="حالة الدفعة" value={status} onChange={(event) => filters.set('status', event.target.value)} sx={{ flex: '1 1 150px' }}><MenuItem value="">الصالحة والملغاة</MenuItem><MenuItem value="posted">صالحة</MenuItem><MenuItem value="cancelled">ملغاة</MenuItem></TextField>
      <TextField label="من تاريخ" type="date" value={filters.params.get('from') ?? ''} onChange={(event) => filters.set('from', event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 170px' }} />
      <TextField label="إلى تاريخ" type="date" value={filters.params.get('to') ?? ''} onChange={(event) => filters.set('to', event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 170px' }} />
    </div><Button onClick={() => setPickMember(!pickMember)} sx={{ mt: 1 }}>{memberId ? 'تغيير المنتسب المحدد' : 'تصفية حسب منتسب'}</Button>
      {memberId && <Button onClick={() => filters.set('memberId', '')}>إظهار جميع المنتسبين</Button>}
      {pickMember && <PaymentMemberSelect onSelect={(id) => { filters.set('memberId', id); setPickMember(false); }} />}
    </Card>
    {search.trim() !== debounced || query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <Card>
      {query.data.items.length ? <DataTable label="قائمة الدفعات" rows={query.data.items} columns={[
        { key: 'member', label: 'المنتسب', render: (row) => <><Link to={`/members/${row.memberId}`}>{row.member?.fullName ?? 'كشف المنتسب'}</Link><Typography variant="body2"><bdi dir="ltr">{row.member?.membershipNumber}</bdi></Typography></> },
        { key: 'amount', label: 'المبلغ', render: (row) => <Money value={row.amount} /> },
        { key: 'date', label: 'التاريخ', render: (row) => <bdi>{civilDate(row.paidOn)}</bdi> },
        { key: 'category', label: 'النوع / الوسيلة', render: (row) => <>{categoryLabels[row.category]}<Typography variant="body2">{methodLabels[row.method]}</Typography></> },
        { key: 'author', label: 'المسجل', render: (row) => row.createdBy?.fullName ?? '—' },
        { key: 'status', label: 'الحالة', render: (row) => <Chip size="small" color={row.status === 'posted' ? 'success' : 'error'} label={row.status === 'posted' ? 'صالحة' : 'ملغاة'} /> },
        { key: 'details', label: 'التفاصيل والإيصال', render: (row) => <Link to={`/payments/${row.id}`}>عرض الدفعة</Link> },
      ]} /> : <EmptyState title="لا توجد دفعات بهذه المرشحات" description="غيّر البحث أو الفترة أو النوع أو المنتسب." />}
      <ListPagination {...query.data} onPage={(value) => filters.set('page', String(value))} onLimit={(value) => filters.set('limit', String(value))} />
    </Card>}
  </>;
}
