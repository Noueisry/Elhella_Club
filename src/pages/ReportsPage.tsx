import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Chip, Typography } from '@mui/material';
import type { ReportKind, ReportQuery } from '../models/report';
import { reportTitles } from '../models/report';
import { getReport } from '../services/report.service';
import { errorMessage } from '../services/auth.service';
import { categoryLabels, civilDate, formatCount, methodLabels, obligationLabel } from '../utils/business-format';
import { DataTable, ListPagination, Metrics, Money, PageHeader, PaymentState } from '../components/BusinessUi';
import { ReportFilters } from '../components/ReportFilters';
import { DocumentActions } from '../components/DocumentActions';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';

export function ReportsPage({ individual = false }: { individual?: boolean }) {
  const { id = '' } = useParams(), [params, setParams] = useSearchParams();
  const rawKind = params.get('kind') ?? 'monthly', kind: ReportKind = individual ? 'statement' : Object.hasOwn(reportTitles, rawKind) ? rawKind as ReportKind : 'monthly';
  const input: ReportQuery = {};
  for (const name of ['date', 'month', 'from', 'to', 'asOf', 'memberId', 'eventId', 'recordedBefore'] as const) if (params.get(name)) input[name] = params.get(name)!;
  for (const name of ['year', 'page', 'limit', 'paymentPage', 'paymentLimit'] as const) if (params.get(name)) input[name] = Number(params.get(name));
  if (individual) { input.memberId = id; delete input.eventId; }
  const path = individual ? `/members/${id}/historical-statement` : `/reports/${kind}`;
  const query = useQuery({ queryKey: ['business', 'report', path, input], queryFn: ({ signal }) => getReport(path, input, signal), enabled: kind !== 'statement' || Boolean(input.memberId) });
  function change(key: keyof ReportQuery, value: string) { setParams((previous) => { const next = new URLSearchParams(previous); if (value) next.set(key, value); else next.delete(key); next.delete('recordedBefore'); next.delete('page'); next.delete('paymentPage'); return next; }, { replace: true, flushSync: true }); }
  function paginate(key: keyof ReportQuery, value: number) { setParams((previous) => { const next = new URLSearchParams(previous); next.set(key, String(value)); if (query.data) next.set('recordedBefore', query.data.meta.recordedBefore); return next; }, { replace: true, flushSync: true }); }
  const data = query.data, exportParams = { ...input, recordedBefore: data?.meta.recordedBefore };
  return <>
    <PageHeader title={individual ? 'كشف الحساب والطباعة' : 'التقارير'} back={individual ? `/members/${id}` : '/'} description="استحقاقات الفترة والتحصيل والوضعية التاريخية بحسابات دقيقة." actions={data && <DocumentActions path={individual ? `/members/${id}/statement` : `/reports/${kind}`} params={exportParams} filename={`${kind}-${data.meta.asOf}.pdf`} />} />
    <ReportFilters kind={kind} input={input} individual={individual} memberName={data?.meta.member?.fullName} eventName={data?.meta.event?.name} onChange={change} onKind={(value) => setParams({ kind: value }, { replace: true, flushSync: true })} />
    {kind === 'statement' && !input.memberId ? <EmptyState title="اختر المنتسب" description="افتح اختيار المنتسب لعرض كشف حسابه." /> : query.isPending ? <LoadingState label="جارٍ إعداد التقرير…" /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : data && <>
      <Typography component="h2" variant="h2" sx={{ mb: 1 }}>{data.meta.title}{data.meta.member ? ` · ${data.meta.member.fullName}` : ''}{data.meta.event ? ` · ${data.meta.event.name}` : ''}</Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>فترة الاستحقاقات والتحصيل: {data.meta.from === '1900-01-01' ? 'بداية السجل' : <bdi>{civilDate(data.meta.from)}</bdi>} إلى <bdi>{civilDate(data.meta.to === '9998-12-31' ? data.meta.asOf : data.meta.to)}</bdi>. تفاصيل الكشف تشمل أيضاً الالتزامات المستقبلية المسجلة إذا لم تُحدد فترة.</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>الوضعية حتى <bdi>{civilDate(data.meta.asOf)}</bdi> · الإقفال (UTC): <bdi dir="ltr">{data.meta.recordedBefore}</bdi> · <bdi dir="ltr">{data.meta.businessTimezone}</bdi></Typography>
      <Metrics items={[
        { label: 'المساهمات المستحقة في الفترة', value: data.totals.dueInPeriod.due }, { label: 'المحصل في الفترة', value: data.totals.collectionsInPeriod, hint: 'دفعات صالحة عند الإقفال ومؤرخة ضمن الفترة، وقد تسدد ديوناً أقدم.' },
        { label: 'المتبقي من مستحقات الفترة', value: data.totals.dueInPeriod.remaining }, { label: 'إجمالي المتأخرات حتى الوضعية', value: data.totals.stock.remaining },
        { label: 'المتأخرات الشهرية', value: data.totals.stock.monthlyRemaining }, { label: 'متأخرات الدورات', value: data.totals.stock.eventRemaining },
        { label: 'الشهرية المستحقة في الفترة', value: data.totals.dueInPeriod.monthlyDue }, { label: 'الدورات المستحقة في الفترة', value: data.totals.dueInPeriod.eventsDue }, { label: 'الالتزامات المستقبلية المتبقية', value: data.totals.future.remaining },
      ]} />
      <Alert severity="info" sx={{ mb: 3 }}>المحصل في الفترة والمسدد من استحقاقاتها لهما نطاقان مختلفان. المسدد من استحقاقات الفترة حتى الوضعية: <Money value={data.totals.dueInPeriod.paid} />. المستحقات المسددة: <bdi>{formatCount(data.totals.dueInPeriod.paidCount)}</bdi>، الجزئية: <bdi>{formatCount(data.totals.dueInPeriod.partialCount)}</bdi>، غير المسددة: <bdi>{formatCount(data.totals.dueInPeriod.unpaidCount)}</bdi>. الدفعات الملغاة عند الإقفال مستبعدة من المجاميع. الأسماء هي بيانات الملفات الحالية.</Alert>
      {kind === 'arrears' && <Card sx={{ mb: 3 }}><Typography component="h2" variant="h2" sx={{ p: 2.5 }}>المتأخرات حسب المنتسب</Typography>{data.arrears.items.length ? <DataTable label="تقرير المتأخرات حسب المنتسب" rows={data.arrears.items} columns={[
        { key: 'member', label: 'المنتسب', render: (row) => <Link to={`/members/${row.id}`}>{row.memberName}</Link> }, { key: 'monthly', label: 'الشهرية', render: (row) => <Money value={row.monthlyArrears} /> }, { key: 'event', label: 'الدورات', render: (row) => <Money value={row.eventArrears} /> }, { key: 'total', label: 'الإجمالي', render: (row) => <Money value={row.totalArrears} /> },
      ]} /> : <EmptyState title="لا توجد متأخرات" description="لا توجد ديون مستحقة ضمن النطاق عند الإقفال." />}<ListPagination {...data.arrears} onPage={(v) => paginate('page', v)} onLimit={(v) => { change('limit', String(v)); }} /></Card>}
      <Card sx={{ mb: 3 }}><Typography component="h2" variant="h2" sx={{ p: 2.5 }}>تفاصيل المساهمات</Typography>{data.contributions.items.length ? <DataTable label="مساهمات التقرير" rows={data.contributions.items} columns={[
        { key: 'member', label: 'المنتسب', render: (row) => <Link to={`/members/${row.memberId}`}>{row.memberName}<br /><bdi dir="ltr">{row.membershipNumber}</bdi></Link> }, { key: 'label', label: 'الفترة / الدورة', render: obligationLabel }, { key: 'dueOn', label: 'الاستحقاق', render: (row) => <bdi>{civilDate(row.dueOn)}</bdi> }, { key: 'due', label: 'المستحق', render: (row) => <Money value={row.amount} /> }, { key: 'paid', label: 'المسدد حتى الوضعية', render: (row) => <Money value={row.paidAmount} /> }, { key: 'left', label: 'المتبقي', render: (row) => <Money value={row.remainingAmount} /> }, { key: 'state', label: 'الحالة', render: (row) => <PaymentState row={row} /> },
      ]} /> : <EmptyState title="لا توجد مساهمات في هذا النطاق" description="التسجيلات اللاحقة لوقت الإقفال لا تدخل في الوضعية التاريخية." />}<ListPagination {...data.contributions} onPage={(v) => paginate('page', v)} onLimit={(v) => change('limit', String(v))} /></Card>
      {kind !== 'arrears' && <Card><Typography component="h2" variant="h2" sx={{ p: 2.5 }}>دفعات الفترة</Typography>{data.payments.items.length ? <DataTable label="دفعات التقرير" rows={data.payments.items} columns={[
        { key: 'member', label: 'المنتسب', render: (row) => row.memberName }, { key: 'receipt', label: 'رقم الإيصال', render: (row) => <Link to={`/payments/${row.id}`}><bdi dir="ltr" className="receipt-number">{row.receiptNumber}</bdi></Link> }, { key: 'date', label: 'التاريخ', render: (row) => <bdi>{civilDate(row.paidOn)}</bdi> }, { key: 'amount', label: 'المبلغ ضمن النطاق', render: (row) => <Money value={row.amount} /> }, { key: 'type', label: 'النوع / الوسيلة', render: (row) => `${categoryLabels[row.category]} / ${methodLabels[row.method]}` }, { key: 'author', label: 'المسجل', render: (row) => row.authorName }, { key: 'status', label: 'الحالة عند الإقفال', render: (row) => <Chip size="small" label={row.status === 'posted' ? 'صالحة' : 'ملغاة'} color={row.status === 'posted' ? 'success' : 'error'} /> },
      ]} /> : <EmptyState title="لا توجد دفعات في الفترة" description="يُراعى تاريخ الدفع ووقت تسجيله وحالة الإلغاء عند الإقفال." />}<ListPagination {...data.payments} onPage={(v) => paginate('paymentPage', v)} onLimit={(v) => change('paymentLimit', String(v))} /></Card>}
    </>}
  </>;
}
