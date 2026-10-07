import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useStatement, useBusinessMutation } from '../hooks/use-business';
import { useNotify } from '../context/notification-context';
import type { PaymentDetail, PaymentPreview, PaymentRequest } from '../models/payment';
import { postPayment, previewPayment } from '../services/payment.service';
import { errorMessage } from '../services/auth.service';
import { categoryLabels, civilDate, isPositiveMoney, methodLabels, normalizeInputDigits, obligationLabel, validDate } from '../utils/business-format';
import { clearPendingPayment, savePendingPayment } from '../utils/pending-payment';
import { DataTable, ListPagination, Metrics, Money } from './BusinessUi';
import { PaymentMemberSelect } from './PaymentMemberSelect';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

export function PaymentComposer({ userId, memberId, original, replacementId, pending }: {
  userId: string; memberId: string; original?: PaymentDetail; replacementId?: string; pending?: PaymentRequest;
}) {
  const navigate = useNavigate(), notify = useNotify(), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [selectedMember, setSelectedMember] = useState(memberId), [page, setPage] = useState(1), [limit, setLimit] = useState(10);
  const [amount, setAmount] = useState(original?.payment.amount ?? ''), [paidOn, setPaidOn] = useState('');
  const [category, setCategory] = useState<PaymentRequest['input']['category']>(original?.payment.category ?? 'arrears');
  const [method, setMethod] = useState<PaymentRequest['input']['method']>(original?.payment.method ?? 'cash');
  const [notes, setNotes] = useState(original?.payment.notes ?? ''), [reason, setReason] = useState(original?.payment.cancellationReason ?? '');
  const [mode, setMode] = useState<'oldest_due' | 'explicit'>(original?.payment.category === 'other' ? 'explicit' : 'oldest_due');
  const [selected, setSelected] = useState<Record<string, { targetType: 'monthly' | 'event'; amount: string; label: string }>>({});
  const [review, setReview] = useState<{ request: PaymentRequest; preview: PaymentPreview }>();
  const [submitted, setSubmitted] = useState<PaymentRequest | undefined>(pending), [message, setMessage] = useState('');
  const posting = useRef(false), reviewing = useRef(false);
  const statement = useStatement(selectedMember, { page, limit, maturity: 'all' });
  const preview = useMutation({ mutationFn: previewPayment, retry: false }), payment = useBusinessMutation(postPayment);
  const disabled = Boolean(submitted) || payment.isPending || preview.isPending || Boolean(review);
  const date = paidOn || statement.data?.asOf || '';
  const changeMember = (id: string) => { setSelectedMember(id); setSelected({}); setPage(1); setMessage(''); };
  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (reviewing.current || posting.current || submitted) return;
    if (!isPositiveMoney(amount) || !validDate(date)) { setMessage('أدخل مبلغاً موجباً بدقة منزلتين وتاريخاً صالحاً.'); return; }
    if (category === 'other' && !notes.trim()) { setMessage('نوع «أخرى» يحتاج إلى ملاحظات وتحديد المساهمات صراحة.'); return; }
    if (replacementId && reason.trim().length < 3) { setMessage('أدخل سبب التصحيح، ثلاثة أحرف على الأقل.'); return; }
    const allocations = Object.entries(selected).filter(([, value]) => value.amount !== '').map(([contributionId, value]) => ({ contributionId, targetType: value.targetType, amount: value.amount }));
    if (mode === 'explicit' && (!allocations.length || allocations.some((row) => !isPositiveMoney(row.amount)))) { setMessage('حدد مبلغاً موجباً للمساهمات التي تريد تسديدها.'); return; }
    const request: PaymentRequest = { input: { memberId: selectedMember, amount, paidOn: date, category, method, notes: notes.trim() || null,
      idempotencyKey: crypto.randomUUID(), allocationMode: mode, ...(mode === 'explicit' ? { allocations } : {}) },
      ...(replacementId ? { replacementId, reason: reason.trim() } : {}) };
    reviewing.current = true; setMessage('');
    try {
      const result = await preview.mutateAsync(request);
      // Bind confirmation to the exact plan shown. A changed capacity is rejected
      // on posting; it cannot silently redirect money to another contribution.
      const exact: PaymentRequest = { ...request, input: { ...request.input, amount: result.amount, allocationMode: 'explicit',
        allocations: result.allocations.map(({ targetType, contributionId, amount: allocated }) => ({ targetType, contributionId, amount: allocated })) } };
      setReview({ request: exact, preview: result });
    } catch (error) { setMessage(errorMessage(error)); }
    finally { reviewing.current = false; }
  }
  async function confirm(request: PaymentRequest) {
    if (posting.current) return;
    posting.current = true; setMessage('');
    // Fail closed if persistence is unavailable, before sending any cash mutation.
    try { savePendingPayment(userId, request); }
    catch { posting.current = false; setMessage('تعذر حفظ طلب الدفعة في هذا المتصفح. فعّل تخزين الجلسة قبل التأكيد؛ لم تُرسل الدفعة.'); return; }
    try {
      setSubmitted(request); setReview(undefined);
      const result = await payment.mutateAsync(request);
      clearPendingPayment(userId); setSubmitted(undefined);
      notify(result.payment.status === 'cancelled' ? 'هذه العملية سبق تسجيلها ثم إلغاؤها. لم تُسجّل دفعة جديدة.' : result.replayed ? 'تم استرجاع الدفعة المسجلة دون تكرارها.' : 'تم تسجيل الدفعة وإصدار الإيصال.');
      void navigate(`/payments/${result.payment.id}`, { replace: true });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const code = axios.isAxiosError<{ error?: { code?: string } }>(error) ? error.response?.data.error?.code : undefined;
      // Only an explicit business rejection lets the operator edit a new request.
      // Network loss, 5xx and session expiry retain both key AND exact payload.
      if (status && [400, 403, 404, 409, 413, 422].includes(status) && code !== 'IDEMPOTENCY_CONFLICT') {
        clearPendingPayment(userId); setSubmitted(undefined); setMessage(errorMessage(error));
      } else setMessage(`${errorMessage(error)} لم يتأكد استلام نتيجة العملية. استعمل زر الاستعادة بنفس الطلب؛ لا تسجل دفعة أخرى.`);
    } finally { posting.current = false; }
  }
  if (!selectedMember && !submitted) return <PaymentMemberSelect onSelect={changeMember} />;
  return <>
    {submitted && <Card sx={{ p: 2.5, mb: 3 }}>
      <Alert severity="warning">توجد عملية أُرسلت ولم تُحسم نتيجتها في هذه الصفحة. تبقى بياناتها ومفتاحها محفوظين في علامة التبويب لهذا الحساب. أعد الطلب نفسه لاسترجاع النتيجة دون تسجيل مزدوج.</Alert>
      <Typography sx={{ my: 2 }}>المبلغ: <Money value={submitted.input.amount} /> · <bdi>{civilDate(submitted.input.paidOn)}</bdi> · {categoryLabels[submitted.input.category]}</Typography>
      <Button variant="contained" disabled={payment.isPending} onClick={() => { void confirm(submitted); }}>{payment.isPending ? 'جارٍ استرجاع النتيجة…' : 'استعادة نتيجة العملية دون تكرارها'}</Button>
    </Card>}
    {message && <Alert severity="error" role="alert" sx={{ mb: 2 }}>{message}</Alert>}
    {statement.isPending ? <LoadingState /> : statement.isError ? <ErrorState message={errorMessage(statement.error)} onRetry={() => { void statement.refetch(); }} /> : <>
      <Card sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box><Typography component="h2" variant="h2">{statement.data.member.fullName}</Typography><Typography><bdi dir="ltr">{statement.data.member.membershipNumber}</bdi></Typography></Box>
          <Box><Button component={Link} to={`/members/${selectedMember}`}>كشف الحساب</Button>{!replacementId && <Button disabled={disabled} onClick={() => changeMember('')}>اختيار منتسب آخر</Button>}</Box>
        </Box>
        <Typography variant="body2" sx={{ mt: 1 }}>الرصيد الحالي: <Money value={statement.data.totals.remaining} /> · المتأخرات: <Money value={statement.data.totals.arrears} /></Typography>
      </Card>
      <Card component="form" onSubmit={(event) => { void prepare(event); }} sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        {replacementId && <Alert severity="warning" sx={{ mb: 2 }}>يُلغي التأكيد الدفعة الأصلية ويُسجل البديل في عملية واحدة. يبقى الأصل محفوظاً ويصبح إيصالُه ملغى.</Alert>}
        <Box className="filter-bar">
          <TextField required label="مبلغ الدفعة (MRU)" value={amount} onChange={(event) => setAmount(normalizeInputDigits(event.target.value))} disabled={disabled} sx={{ flex: '1 1 180px' }} slotProps={{ htmlInput: { inputMode: 'decimal', dir: 'ltr', maxLength: 16 } }} />
          <TextField required label="تاريخ الدفع" type="date" value={date} onChange={(event) => setPaidOn(event.target.value)} disabled={disabled} sx={{ flex: '1 1 180px' }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: statement.data.member.joinedOn, max: statement.data.asOf, dir: 'ltr' } }} />
          <TextField select label="نوع الدفعة" value={category} onChange={(event) => { setCategory(event.target.value as typeof category); setSelected({}); if (event.target.value === 'other') setMode('explicit'); }} disabled={disabled} sx={{ flex: '1 1 180px' }}>{Object.entries(categoryLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          <TextField select label="طريقة الدفع" value={method} onChange={(event) => setMethod(event.target.value as typeof method)} disabled={disabled} sx={{ flex: '1 1 160px' }}>{Object.entries(methodLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        </Box>
        <TextField fullWidth multiline minRows={2} label="ملاحظات" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={disabled} required={category === 'other'} slotProps={{ htmlInput: { maxLength: 5000 } }} sx={{ my: 2 }} />
        {replacementId && <TextField required fullWidth label="سبب التصحيح" value={reason} onChange={(event) => setReason(event.target.value)} disabled={disabled || original?.payment.status === 'cancelled'} slotProps={{ htmlInput: { maxLength: 500 } }} sx={{ mb: 2 }} />}
        <TextField fullWidth select label="توزيع الدفعة" value={mode} disabled={disabled || category === 'other'} onChange={(event) => setMode(event.target.value as typeof mode)}>
          <MenuItem value="oldest_due">تسديد أقدم الديون المستحقة أولاً</MenuItem><MenuItem value="explicit">تحديد المساهمات والمبالغ يدوياً</MenuItem>
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>التوزيع الآلي يشمل الديون المستحقة في تاريخ الدفع وفق النوع المختار. المساهمات المستقبلية تُحدد يدوياً؛ لا تُقبل ضمن المتأخرات. يجب توزيع كامل المبلغ، ولا يُقبل مبلغ زائد.</Typography>
        {mode === 'explicit' && <>
          <DataTable label="اختيار المساهمات للتسديد" rows={statement.data.contributions.items.filter((row) => category !== 'monthly' && category !== 'event' || row.targetType === category)} columns={[
            { key: 'period', label: 'الفترة / الدورة', render: (row) => <>{obligationLabel(row)}<Typography variant="body2">{row.dueStatusLabel} · <bdi>{civilDate(row.dueOn)}</bdi></Typography></> },
            { key: 'remaining', label: 'المتبقي الحالي', render: (row) => <Money value={row.remainingAmount} /> },
            { key: 'allocation', label: 'المبلغ المراد تسديده', render: (row) => <TextField size="small" label={`تسديد ${obligationLabel(row)}`} value={selected[row.id]?.amount ?? ''} disabled={disabled} slotProps={{ htmlInput: { inputMode: 'decimal', dir: 'ltr', maxLength: 16 } }} onChange={(event) => setSelected((previous) => ({ ...previous, [row.id]: { targetType: row.targetType, amount: normalizeInputDigits(event.target.value), label: obligationLabel(row) } }))} /> },
          ]} />
          <ListPagination {...statement.data.contributions} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />
          {Object.entries(selected).filter(([, value]) => value.amount).map(([id, value]) => <Typography key={id} variant="body2">{value.label}: <bdi dir="ltr">{value.amount} MRU</bdi></Typography>)}
          {replacementId && <Alert severity="info" sx={{ my: 2 }}>المتبقي الحالي يشمل الدفعة الأصلية. تُحتسب مبالغها المحررة عند معاينة البديل على الخادم.</Alert>}
        </>}
        <Button type="submit" variant="contained" disabled={disabled} sx={{ mt: 2 }}>{preview.isPending ? 'جارٍ التحقق من التوزيع…' : 'مراجعة الدفعة قبل التأكيد'}</Button>
      </Card>
    </>}
    <Dialog open={Boolean(review)} fullWidth maxWidth="md" fullScreen={mobile} dir="rtl" aria-labelledby="payment-review-title" onClose={() => { if (!posting.current) setReview(undefined); }}>
      <DialogTitle id="payment-review-title">تأكيد تسجيل الدفعة</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>{review && <>
        <Typography sx={{ mb: 2 }}>{statement.data?.member.fullName} · {categoryLabels[review.request.input.category]} · {methodLabels[review.request.input.method]} · <bdi>{civilDate(review.request.input.paidOn)}</bdi></Typography>
        <Metrics items={[{ label: 'المبلغ المراد تحصيله', value: review.preview.amount }, { label: 'الرصيد المتوقع بعد العملية', value: review.preview.remainingAfter }]} />
        <DataTable label="توزيع الدفعة قبل التأكيد" rows={review.preview.allocations.map((row) => ({ ...row, id: row.contributionId }))} columns={[
          { key: 'label', label: 'الفترة / الدورة', render: (row) => obligationLabel(row) },
          { key: 'amount', label: 'المبلغ المسدد', render: (row) => <Money value={row.amount} /> },
          { key: 'remaining', label: 'المتبقي لهذه المساهمة', render: (row) => <Money value={row.remainingAfter} /> },
        ]} />
        {review.request.input.notes && <Typography sx={{ my: 2 }}>ملاحظات: {review.request.input.notes}</Typography>}
        {review.request.reason && <Alert severity="warning" sx={{ my: 2 }}>سبب التصحيح: {review.request.reason}</Alert>}
        <Alert severity="info" sx={{ mt: 2 }}>هذه معاينة من الخادم. يعاد التحقق عند التأكيد، ولا تثبت الدفعة إلا بعد استلام نتيجة التسجيل.</Alert>
      </>}</DialogContent>
      <DialogActions><Button disabled={payment.isPending} onClick={() => setReview(undefined)}>العودة للتعديل</Button><Button variant="contained" disabled={payment.isPending || !review} onClick={() => { if (review) void confirm(review.request); }}>تأكيد واستلام الإيصال</Button></DialogActions>
    </Dialog>
  </>;
}
