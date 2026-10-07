import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, Card, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useEvents } from '../hooks/use-business';
import { useAuth } from '../context/auth-context';
import { useDebounced } from '../hooks/use-debounced';
import { useListFilters } from '../hooks/use-list-filters';
import { errorMessage } from '../services/auth.service';
import { civilDate } from '../utils/business-format';
import { DataTable, ListPagination, Money, PageHeader } from '../components/BusinessUi';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { EventFormDialog } from '../components/EventFormDialog';

export function EventsPage() {
  const filters = useListFilters(), { user } = useAuth(), navigate = useNavigate(), [creating, setCreating] = useState(false);
  const search = filters.params.get('search') ?? '', debounced = useDebounced(search);
  const from = filters.params.get('from') ?? '', to = filters.params.get('to') ?? '';
  const query = useEvents({ search: debounced || undefined, from: from || undefined, to: to || undefined, page: filters.page, limit: filters.limit });
  const waiting = search.trim() !== debounced;
  return <>
    <PageHeader title="الدورات" description="الدورات والمسابقات ومساهمات المنتسبين المعنيين بها." actions={user?.permissions.includes('events.manage') && <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setCreating(true)}>إضافة دورة</Button>} />
    <Card>
      <Box className="filter-bar" sx={{ p: 2.5 }}>
        <TextField label="البحث عن دورة" value={search} onChange={(event) => filters.set('search', event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: '2 1 240px' }} />
        <TextField type="date" label="من تاريخ" value={from} onChange={(event) => filters.set('from', event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 170px' }} />
        <TextField type="date" label="إلى تاريخ" value={to} onChange={(event) => filters.set('to', event.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 170px' }} />
      </Box>
      {waiting || query.isPending ? <LoadingState /> : query.isError ? <Box sx={{ p: 2 }}><ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /></Box> : <>
        {query.data.items.length ? <DataTable label="قائمة الدورات" rows={query.data.items} columns={[
          { key: 'name', label: 'الدورة', render: (event) => <Link className="record-link" to={`/events/${event.id}`}>{event.name}</Link> },
          { key: 'type', label: 'النوع', render: (event) => event.type },
          { key: 'date', label: 'التاريخ', render: (event) => <bdi>{civilDate(event.eventOn)}</bdi> },
          { key: 'amount', label: 'مساهمة المنتسب الحالية', render: (event) => <Money value={event.contributionAmount} /> },
          { key: 'action', label: 'التفاصيل', render: (event) => <Button size="small" component={Link} to={`/events/${event.id}`}>عرض المشاركين</Button> },
        ]} /> : <EmptyState title="لا توجد دورات بهذه المرشحات" description="غيّر البحث أو الفترة، أو أضف دورة جديدة." />}
        <ListPagination {...query.data} onPage={(value) => filters.set('page', String(value))} onLimit={(value) => filters.set('limit', String(value))} />
      </>}
    </Card>
    {creating && <EventFormDialog onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); void navigate(`/events/${id}`); }} />}
  </>;
}
