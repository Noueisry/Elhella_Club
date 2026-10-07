import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, Chip, Typography } from '@mui/material';
import { useMemberPayments, useStatement } from '../hooks/use-business';
import { errorMessage } from '../services/auth.service';
import { categoryLabels, civilDate, methodLabels, obligationLabel } from '../utils/business-format';
import { DataTable, ListPagination, MemberBadge, Metrics, Money, PageHeader, PaymentLink, PaymentState, type Column } from '../components/BusinessUi';
import { MemberActions } from '../components/MemberActions';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import type { Obligation } from '../models/business';

const columns: Column<Obligation>[] = [
  { key: 'label', label: 'الفترة / الدورة', render: (row) => <>{obligationLabel(row)}<Typography variant="body2" color="text.secondary">الاستحقاق: <bdi>{civilDate(row.dueOn)}</bdi></Typography>{row.isOverdue && <Typography variant="body2" color="warning.main">سبب المتأخرات: مبلغ مستحق لم يُسدّد بالكامل</Typography>}</> },
  { key: 'amount', label: 'المستحق', render: (row) => <Money value={row.amount} /> },
  { key: 'paid', label: 'المدفوع', render: (row) => <Money value={row.paidAmount} /> },
  { key: 'remaining', label: 'المتبقي', render: (row) => <Money value={row.remainingAmount} /> },
  { key: 'status', label: 'الحالة', render: (row) => <PaymentState row={row} /> },
];
export function MemberDetailPage() {
  const { id = '' } = useParams(), navigate = useNavigate();
  const [duePage, setDuePage] = useState(1), [dueLimit, setDueLimit] = useState(10), [futurePage, setFuturePage] = useState(1), [futureLimit, setFutureLimit] = useState(10), [historyPage, setHistoryPage] = useState(1), [historyLimit, setHistoryLimit] = useState(10);
  const query = useStatement(id, { maturity: 'due', page: duePage, limit: dueLimit });
  const future = useStatement(id, { maturity: 'future', page: futurePage, limit: futureLimit });
  const payments = useMemberPayments(id, historyPage, historyLimit);
  if (query.isPending) return <LoadingState label="جارٍ تحميل كشف الحساب…" />;
  if (query.isError) return <><PageHeader title="كشف حساب المنتسب" back="/members" /><ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /></>;
  const data = query.data, { member, totals } = data;
  return <>
    <PageHeader title={member.fullName} back="/members" description={<>كشف الحساب حتى <bdi>{civilDate(data.asOf)}</bdi></>} actions={<><PaymentLink memberId={id} /><Button component={Link} to={`/members/${id}/report`} variant="outlined">كشف الحساب والطباعة</Button><MemberActions member={member} onRemoved={() => { void navigate('/members'); }} /></>} />
    <Card component="section" aria-label="البيانات الشخصية" sx={{ p: 2.5, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}><Typography component="h2" variant="h2">البيانات الشخصية</Typography><MemberBadge member={member} /></Box>
      <Box component="dl" className="detail-grid">
        <div><dt>رقم العضوية</dt><dd><bdi dir="ltr">{member.membershipNumber}</bdi></dd></div>
        <div><dt>الهاتف</dt><dd><bdi dir="ltr">{member.phone}</bdi></dd></div>
        <div><dt>تاريخ الانضمام</dt><dd><bdi>{civilDate(member.joinedOn)}</bdi></dd></div>
        <div><dt>المساهمة الشهرية الحالية</dt><dd>{data.currentMonthlyRate ? <><Money value={data.currentMonthlyRate.amount} /><Typography variant="body2" color="text.secondary">التعريفة منذ <bdi>{civilDate(data.currentMonthlyRate.effectiveOn)}</bdi>. الاستحقاقات السابقة تحتفظ بتعريفتها.</Typography></> : 'لا توجد تعريفة متاحة'}</dd></div>
      </Box>
      {member.notes && <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>ملاحظات: {member.notes}</Typography>}
      {member.archivedAt && <Alert severity="info" sx={{ mt: 2 }}>هذا الملف مؤرشف. يبقى تاريخه المالي محفوظاً ويمكن تسديد ديونه.</Alert>}
    </Card>
    <Box component="section" aria-label="الوضعية المالية">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}><Typography component="h2" variant="h2">الوضعية المالية</Typography><Chip label={totals.financialStatusLabel} color={totals.financialStatusLabel === 'مسدد بالكامل' ? 'success' : totals.financialStatusLabel === 'عليه متأخرات' ? 'warning' : 'default'} /></Box>
      <Metrics items={[
        { label: 'إجمالي المساهمات الشهرية', value: totals.monthlyDue }, { label: 'إجمالي مساهمات الدورات', value: totals.eventsDue },
        { label: 'إجمالي ما دفعه', value: totals.totalPaid, hint: 'الدفعات الصالحة فقط؛ تُستبعد الملغاة.' },
        { label: 'إجمالي المستحق', value: totals.totalDue }, { label: 'الرصيد المتبقي', value: totals.remaining, hint: 'يشمل الالتزامات المستقبلية المسجلة.' },
        { label: 'إجمالي المتأخرات', value: totals.arrears, hint: 'المتبقي المستحق حتى اليوم فقط.' },
        { label: 'المتأخرات الشهرية', value: totals.monthlyArrears }, { label: 'متأخرات الدورات', value: totals.eventArrears },
      ]} />
      <Card sx={{ p: 2.5, mb: 3 }}><Typography component="h3" variant="h3">آخر دفعة صالحة</Typography>{data.lastPayment ? <Typography sx={{ mt: 1 }}><Money value={data.lastPayment.amount} /> · <bdi>{civilDate(data.lastPayment.paidOn)}</bdi> · {categoryLabels[data.lastPayment.category]}</Typography> : <Typography variant="body2" color="text.secondary">لم تُسجّل دفعات صالحة لهذا المنتسب.</Typography>}</Card>
    </Box>
    <Card component="section" aria-label="تفاصيل الاستحقاقات والمتأخرات" sx={{ mb: 3 }}>
      <Typography component="h2" variant="h2" sx={{ p: 2.5 }}>تفاصيل الاستحقاقات والمتأخرات</Typography>
      {data.contributions.items.length ? <DataTable label="الاستحقاقات الحالية" rows={data.contributions.items} columns={columns} /> : <EmptyState title="لا توجد استحقاقات حتى اليوم" description="تظهر الالتزامات المستقبلية في القسم التالي." />}
      <ListPagination {...data.contributions} onPage={setDuePage} onLimit={(value) => { setDueLimit(value); setDuePage(1); }} />
    </Card>
    <Card component="section" aria-label="الالتزامات المستقبلية" sx={{ mb: 3 }}>
      <Typography component="h2" variant="h2" sx={{ p: 2.5, pb: 0.5 }}>الالتزامات المستقبلية</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>تدخل في الرصيد المتبقي، ولا تُعدّ متأخرات قبل تاريخ الاستحقاق.</Typography>
      {future.isPending ? <LoadingState /> : future.isError ? <ErrorState message={errorMessage(future.error)} onRetry={() => { void future.refetch(); }} /> : <>
        {future.data.contributions.items.length ? <DataTable label="الالتزامات المستقبلية" rows={future.data.contributions.items} columns={columns} /> : <EmptyState title="لا توجد التزامات مستقبلية" description="جميع الاستحقاقات المسجلة معروضة في القسم السابق." />}
        <ListPagination {...future.data.contributions} onPage={setFuturePage} onLimit={(value) => { setFutureLimit(value); setFuturePage(1); }} />
      </>}
    </Card>
    <Card component="section" aria-label="تاريخ الدفعات">
      <Typography component="h2" variant="h2" sx={{ p: 2.5 }}>تاريخ الدفعات</Typography>
      {payments.isPending ? <LoadingState /> : payments.isError ? <ErrorState message={errorMessage(payments.error)} onRetry={() => { void payments.refetch(); }} /> : <>
        {payments.data.items.length ? <DataTable label="تاريخ الدفعات" rows={payments.data.items} columns={[
          { key: 'date', label: 'التاريخ', render: (payment) => <bdi>{civilDate(payment.paidOn)}</bdi> },
          { key: 'amount', label: 'المبلغ', render: (payment) => <Money value={payment.amount} /> },
          { key: 'category', label: 'نوع الدفعة', render: (payment) => categoryLabels[payment.category] },
          { key: 'method', label: 'طريقة الدفع', render: (payment) => methodLabels[payment.method] },
          { key: 'status', label: 'الحالة', render: (payment) => <><Chip size="small" variant="outlined" color={payment.status === 'posted' ? 'success' : 'error'} label={payment.status === 'posted' ? 'صالحة' : 'ملغاة'} />{payment.cancellationReason && <Typography variant="body2">سبب الإلغاء: {payment.cancellationReason}</Typography>}</> },
          { key: 'receipt', label: 'رقم الإيصال', render: (payment) => <Link to={`/payments/${payment.id}`}><bdi dir="ltr" className="receipt-number">{payment.receiptNumber}</bdi></Link> },
          { key: 'notes', label: 'ملاحظات', render: (payment) => payment.notes || 'لا توجد' },
        ]} /> : <EmptyState title="لا توجد دفعات" description="لم تُسجّل دفعات لهذا المنتسب بعد." />}
        <ListPagination {...payments.data} onPage={setHistoryPage} onLimit={(value) => { setHistoryLimit(value); setHistoryPage(1); }} />
      </>}
    </Card>
  </>;
}
