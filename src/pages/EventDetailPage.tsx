import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Card, MenuItem, TextField, Typography } from '@mui/material';
import type { Obligation } from '../models/business';
import { useAuth } from '../context/auth-context';
import { useNotify } from '../context/notification-context';
import { useBusinessMutation, useEvent } from '../hooks/use-business';
import { useListFilters } from '../hooks/use-list-filters';
import { removeEvent } from '../services/business.service';
import { errorMessage } from '../services/auth.service';
import { civilDate } from '../utils/business-format';
import { DataTable, ListPagination, Metrics, Money, PageHeader, PaymentState } from '../components/BusinessUi';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { EventFormDialog } from '../components/EventFormDialog';
import { ParticipantsDialog } from '../components/ParticipantsDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function EventDetailPage() {
  const { id = '' } = useParams(), filters = useListFilters(), navigate = useNavigate(), notify = useNotify(), { user } = useAuth();
  const [action, setAction] = useState('');
  const raw = filters.params.get('paymentStatus'), paymentStatus = raw === 'paid' || raw === 'partial' || raw === 'unpaid' ? raw as Obligation['paymentStatus'] : '';
  const query = useEvent(id, { paymentStatus: paymentStatus || undefined, page: filters.page, limit: filters.limit }), removal = useBusinessMutation(() => removeEvent(id));
  if (query.isPending) return <LoadingState label="جارٍ تحميل الدورة…" />;
  if (query.isError) return <><PageHeader title="تفاصيل الدورة" back="/events" /><ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /></>;
  const { event, summary, participants } = query.data;
  return <>
    <PageHeader title={event.name} back="/events" description={<>الوضعية حتى <bdi>{civilDate(query.data.asOf)}</bdi></>} actions={user?.permissions.includes('events.manage') && <>
      <Button variant="contained" onClick={() => setAction('participants')}>إضافة منتسبين</Button><Button variant="outlined" onClick={() => setAction('edit')}>تعديل الدورة</Button><Button color="warning" onClick={() => setAction('remove')}>حذف الدورة</Button>
    </>} />
    <Card component="section" aria-label="بيانات الدورة" sx={{ p: 2.5, mb: 3 }}>
      <Box component="dl" className="detail-grid">
        <div><dt>نوع الدورة</dt><dd>{event.type}</dd></div>
        <div><dt>تاريخ الدورة</dt><dd><bdi>{civilDate(event.eventOn)}</bdi></dd></div>
        <div><dt>مساهمة المنتسب الحالية</dt><dd><Money value={event.contributionAmount} /></dd></div>
      </Box>{event.notes && <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>ملاحظات: {event.notes}</Typography>}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>قد تختلف المساهمات المسجلة سابقاً عن التعريفة الحالية. يعرض جدول المشاركين مبلغ كل استحقاق محفوظ.</Typography>
    </Card>
    <Metrics items={[
      { label: 'عدد المشاركين', value: summary.participantCount }, { label: 'المسدّدون بالكامل', value: summary.paidCount },
      { label: 'المسدّدون جزئياً', value: summary.partialCount }, { label: 'غير المسدّدين', value: summary.unpaidCount },
      { label: 'إجمالي المساهمات', value: summary.totalDue }, { label: 'إجمالي المحصّل', value: summary.totalPaid }, { label: 'المتبقي للتحصيل', value: summary.remaining },
    ]} />
    <Card component="section" aria-label="المشاركون">
      <Box sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography component="h2" variant="h2">المشاركون</Typography>
        <TextField select label="حالة التسديد" value={paymentStatus} onChange={(change) => filters.set('paymentStatus', change.target.value)} sx={{ minWidth: 190 }}>
          <MenuItem value="">جميع المشاركين</MenuItem><MenuItem value="paid">مدفوع</MenuItem><MenuItem value="partial">مدفوع جزئياً</MenuItem><MenuItem value="unpaid">غير مدفوع</MenuItem>
        </TextField>
      </Box>
      {participants.items.length ? <DataTable label="مساهمات المشاركين" rows={participants.items} columns={[
        { key: 'name', label: 'المنتسب', render: (row) => <><Link className="record-link" to={`/members/${row.memberId}`}>{row.fullName}</Link><Typography variant="body2"><bdi dir="ltr">{row.membershipNumber}</bdi></Typography></> },
        { key: 'due', label: 'المستحق', render: (row) => <Money value={row.amount} /> },
        { key: 'paid', label: 'المدفوع', render: (row) => <Money value={row.paidAmount} /> },
        { key: 'remaining', label: 'المتبقي', render: (row) => <Money value={row.remainingAmount} /> },
        { key: 'date', label: 'تاريخ الاستحقاق', render: (row) => <bdi>{civilDate(row.dueOn)}</bdi> },
        { key: 'status', label: 'الحالة', render: (row) => <PaymentState row={row} /> },
      ]} /> : <EmptyState title="لا يوجد مشاركون بهذه الحالة" description="غيّر مرشح التسديد أو أضف المنتسبين المعنيين بالدورة." />}
      <ListPagination {...participants} onPage={(value) => filters.set('page', String(value))} onLimit={(value) => filters.set('limit', String(value))} />
    </Card>
    {action === 'edit' && <EventFormDialog event={event} onClose={() => setAction('')} onSaved={() => setAction('')} />}
    {action === 'participants' && <ParticipantsDialog eventId={id} onClose={() => setAction('')} />}
    {action === 'remove' && <ConfirmDialog title="حذف الدورة" description="الحذف نهائي، ويُسمح به فقط عندما لا توجد أي مساهمات مرتبطة بالدورة، حتى لو كانت غير مدفوعة." onClose={() => setAction('')} onConfirm={async () => { await removal.mutateAsync(); notify('تم حذف الدورة.'); void navigate('/events'); }} />}
  </>;
}
