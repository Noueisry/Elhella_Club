import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card } from '@mui/material';
import { useReceipt, useReceiptHtml } from '../hooks/use-payments';
import { getReceiptPdf } from '../services/payment.service';
import { errorMessage } from '../services/auth.service';
import { useNotify } from '../context/notification-context';
import { PageHeader } from '../components/BusinessUi';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
export function ReceiptPage() {
  const { id = '' } = useParams(), receipt = useReceipt(id), html = useReceiptHtml(id), notify = useNotify();
  const frame = useRef<HTMLIFrameElement>(null), busyRef = useRef(false);
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [height, setHeight] = useState(850), [message, setMessage] = useState('');
  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function pdf(share = false) {
    if (busyRef.current || !receipt.data) return;
    busyRef.current = true; setBusy(true); setMessage('');
    try {
      const blob = await getReceiptPdf(id), filename = `${receipt.data.receiptNumber}${receipt.data.isValid ? '' : '-cancelled'}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ title: 'وصل دفع', files: [file] }); }
        catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          download(blob, filename); notify('تم تنزيل الإيصال لأن المشاركة غير متاحة الآن.');
        }
      } else { download(blob, filename); if (share) notify('المشاركة غير متاحة على هذا المتصفح؛ تم تنزيل الإيصال.'); }
    } catch (error) { setMessage(errorMessage(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function print() {
    const document = frame.current?.contentDocument, win = frame.current?.contentWindow;
    if (!document || !win) return;
    await document.fonts.ready; win.focus(); win.print();
  }
  return <>
    <PageHeader title="وصل الدفع" back={`/payments/${id}`} actions={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button variant="contained" disabled={busy || !receipt.data} onClick={() => { void pdf(); }}>حفظ PDF</Button>
      <Button variant="outlined" disabled={!ready} onClick={() => { void print(); }}>طباعة الإيصال</Button>
      <Button variant="outlined" disabled={busy || !receipt.data} onClick={() => { void pdf(true); }}>مشاركة الإيصال</Button>
    </Box>} />
    {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
    {busy && <LoadingState label="جارٍ تجهيز ملف الإيصال…" />}
    {receipt.data?.status === 'cancelled' && <Alert severity="error" sx={{ mb: 2 }}>هذا الإيصال ملغى، ويظهر ذلك في النسخة المطبوعة والملف المحفوظ.{receipt.data.replacementPaymentId && <Button component={Link} to={`/payments/${receipt.data.replacementPaymentId}/receipt`}>الإيصال البديل</Button>}</Alert>}
    {html.isPending ? <LoadingState /> : html.isError ? <ErrorState message={errorMessage(html.error)} onRetry={() => { void html.refetch(); }} /> : <Card sx={{ overflow: 'hidden', mb: 3 }}>
      <iframe ref={frame} title="نسخة الإيصال القابلة للطباعة" srcDoc={html.data} sandbox="allow-same-origin allow-modals" style={{ display: 'block', border: 0, width: '100%', height }} onLoad={() => {
        const document = frame.current?.contentDocument;
        if (document) void document.fonts.ready.then(() => { setHeight(Math.max(450, document.documentElement.scrollHeight + 24)); setReady(true); });
      }} />
    </Card>}
    <Alert severity="info">يعرض الإيصال الاسم والرصيد المحفوظين عند العملية. تُشارك نسخة الملف باختيارك من المتصفح؛ تنزيل الإيصال لا يسجل دفعة جديدة.</Alert>
  </>;
}
