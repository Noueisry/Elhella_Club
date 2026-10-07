import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { usePayment, useReceipt } from '../hooks/use-payments';
import { useBusinessMutation } from '../hooks/use-business';
import { useAuth } from '../context/auth-context';
import { useNotify } from '../context/notification-context';
import { cancelPayment } from '../services/payment.service';
import { errorMessage } from '../services/auth.service';
import { categoryLabels, civilDate, methodLabels, obligationLabel } from '../utils/business-format';
import { DataTable, Money, PageHeader } from '../components/BusinessUi';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
export function PaymentDetailPage() {
  const { id = '' } = useParams(), query = usePayment(id), receipt = useReceipt(id), { user } = useAuth(), notify = useNotify();
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const cancel = useBusinessMutation(cancelPayment);
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />;
  const { payment, replacementPaymentId } = query.data;
  const canCorrect = user?.permissions.includes('payments.correct');
  async function confirm() {
    if (cancel.isPending) return;
    if (reason.trim().length < 3) { setMessage('سبب الإلغاء مطلوب، ثلاثة أحرف على الأقل.'); return; }
    setMessage('');
    try { await cancel.mutateAsync({ id, reason: reason.trim() }); setOpen(false); notify('أُلغيت الدفعة وأصبح إيصالها غير صالح.'); }
    catch (error) { setMessage(errorMessage(error)); }
  }
  return <>
    <PageHeader title="تفاصيل الدفعة" back="/payments" actions={<>{user?.permissions.includes('receipts.read') && <Button component={Link} to={`/payments/${id}/receipt`} variant="contained">عرض الإيصال</Button>}{canCorrect && !replacementPaymentId && <Button component={Link} to={`/payments/${id}/replace`} variant="outlined">تصحيح ببديل</Button>}{canCorrect && payment.status === 'posted' && <Button color="error" variant="outlined" onClick={() => setOpen(true)}>إلغاء الدفعة</Button>}</>} />
    <Card sx={{ p: 2.5, mb: 3 }}>
      <Chip color={payment.status === 'posted' ? 'success' : 'error'} label={payment.status === 'posted' ? 'دفعة صالحة' : 'دفعة ملغاة'} sx={{ mb: 2 }} />
      <div className="detail-grid">
        <div><Typography color="text.secondary">المنتسب</Typography><Link to={`/members/${payment.memberId}`}>{payment.member?.fullName ?? 'كشف المنتسب'}</Link></div>
        <div><Typography color="text.secondary">المبلغ</Typography><Money value={payment.amount} /></div>
        <div><Typography color="text.secondary">التاريخ</Typography><bdi>{civilDate(payment.paidOn)}</bdi></div>
        <div><Typography color="text.secondary">نوع الدفعة</Typography>{categoryLabels[payment.category]}</div>
        <div><Typography color="text.secondary">طريقة الدفع</Typography>{methodLabels[payment.method]}</div>
        <div><Typography color="text.secondary">المسجل</Typography>{payment.createdBy?.fullName ?? '—'}</div>
      </div>
      <Typography sx={{ mt: 2 }}>رقم الإيصال: <bdi dir="ltr" className="receipt-number">{payment.receiptNumber}</bdi></Typography>
      {payment.notes && <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>ملاحظات: {payment.notes}</Typography>}
      {payment.status === 'cancelled' && <Alert severity="error" sx={{ mt: 2 }}>الإيصال ملغى. سبب الإلغاء: {payment.cancellationReason}{payment.cancelledAt && <> · <bdi>{civilDate(payment.cancelledAt.slice(0, 10))}</bdi></>}</Alert>}
      {replacementPaymentId && <Button component={Link} to={`/payments/${replacementPaymentId}`} sx={{ mt: 2 }}>الدفعة البديلة</Button>}
      {payment.replacesPaymentId && <Button component={Link} to={`/payments/${payment.replacesPaymentId}`} sx={{ mt: 2 }}>الدفعة الأصلية المحفوظة</Button>}
    </Card>
    <Card sx={{ mb: 3 }}><Typography component="h2" variant="h2" sx={{ p: 2.5 }}>تفاصيل توزيع الدفعة</Typography>
      {receipt.isPending ? <LoadingState /> : receipt.isError ? <ErrorState message={errorMessage(receipt.error)} onRetry={() => { void receipt.refetch(); }} /> : <>
        <DataTable label="أجزاء الدفعة" rows={receipt.data.snapshot.allocations.map((row) => ({ ...row, id: row.contributionId }))} columns={[
          { key: 'period', label: 'الفترة / الدورة', render: (row) => obligationLabel(row) },
          { key: 'date', label: 'الاستحقاق', render: (row) => <bdi>{civilDate(row.dueOn)}</bdi> },
          { key: 'amount', label: 'المبلغ المسدد', render: (row) => <Money value={row.amount} /> },
        ]} /><Typography sx={{ p: 2.5 }}>الرصيد المتبقي عند العملية: <Money value={receipt.data.snapshot.remainingBalance} /></Typography>
      </>}
    </Card>
    <Dialog open={open} onClose={() => { if (!cancel.isPending) setOpen(false); }} dir="rtl" aria-labelledby="cancel-payment-title" fullWidth maxWidth="sm">
      <DialogTitle id="cancel-payment-title">تأكيد إلغاء الدفعة</DialogTitle><DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>ستعود مبالغ الدفعة إلى الديون ويصبح الإيصال ملغى. تبقى الدفعة الأصلية وأجزاؤها محفوظة. لا يحذف الإلغاء السجل المالي.</Alert>
        <TextField fullWidth required label="سبب الإلغاء" value={reason} disabled={cancel.isPending} onChange={(event) => setReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
        {message && <Alert severity="error" sx={{ mt: 2 }}>{message}</Alert>}
      </DialogContent><DialogActions><Button disabled={cancel.isPending} onClick={() => setOpen(false)}>رجوع</Button><Button variant="contained" color="error" disabled={cancel.isPending} onClick={() => { void confirm(); }}>{cancel.isPending ? 'جارٍ الإلغاء…' : 'تأكيد الإلغاء'}</Button></DialogActions>
    </Dialog>
  </>;
}
