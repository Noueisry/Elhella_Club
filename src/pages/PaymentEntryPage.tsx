import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { useAuth } from '../context/auth-context';
import { usePayment } from '../hooks/use-payments';
import { PaymentComposer } from '../components/PaymentComposer';
import { PageHeader } from '../components/BusinessUi';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { errorMessage } from '../services/auth.service';
import { readPendingPayment } from '../utils/pending-payment';

export function PaymentEntryPage() {
  const [params] = useSearchParams(), { id = '' } = useParams(), original = usePayment(id), { user } = useAuth();
  const pending = readPendingPayment(user!.id);
  if (pending?.replacementId && !user!.permissions.includes('payments.correct')) return <Alert severity="error">هذه العملية تحتاج إلى صلاحية التصحيح الإداري.</Alert>;
  if (id && !pending && original.isPending) return <LoadingState />;
  if (id && !pending && original.isError) return <ErrorState message={errorMessage(original.error)} onRetry={() => { void original.refetch(); }} />;
  return <>
    <PageHeader title={id || pending?.replacementId ? 'تصحيح دفعة ببديل' : 'تسجيل دفعة'} back="/payments" description="راجع توزيع المبلغ قبل التأكيد. لا يتم تسجيل أي دفعة قبل موافقة الخادم." />
    {id && !pending && original.data?.replacementPaymentId ? <Alert severity="info">توجد دفعة بديلة لهذا الأصل. <Button component={Link} to={`/payments/${original.data.replacementPaymentId}`}>فتح الدفعة البديلة</Button></Alert> :
      <PaymentComposer key={`${user!.id}:${id}:${params.get('memberId') ?? ''}`} userId={user!.id} memberId={pending?.input.memberId ?? original.data?.payment.memberId ?? params.get('memberId') ?? ''} original={pending ? undefined : original.data} replacementId={pending?.replacementId ?? (id || undefined)} pending={pending} />}
  </>;
}
