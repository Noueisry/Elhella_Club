import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from '@mui/material';
import type { ReportQuery } from '../models/report';
import { getDocumentHtml, getDocumentPdf } from '../services/report.service';
import { errorMessage } from '../services/auth.service';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
export function DocumentActions({ path, params, filename }: { path: string; params: ReportQuery; filename: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), downloading = useRef(false), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const html = useQuery({ queryKey: ['business', 'document-html', path, params], queryFn: ({ signal }) => getDocumentHtml(`${path}.html`, params, signal), enabled: open });
  async function save() {
    if (downloading.current) return;
    downloading.current = true; setBusy(true); setMessage('');
    try { const blob = await getDocumentPdf(`${path}.pdf`, params), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (error) { setMessage(errorMessage(error)); }
    finally { downloading.current = false; setBusy(false); }
  }
  async function print() { const document = frame.current?.contentDocument, win = frame.current?.contentWindow; if (document && win) { await document.fonts.ready; win.focus(); win.print(); } }
  return <Box sx={{ display: 'grid', gap: 1 }}>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}><Button variant="outlined" onClick={() => { setReady(false); setOpen(true); }}>نسخة قابلة للطباعة</Button><Button variant="contained" disabled={busy} onClick={() => { void save(); }}>{busy ? 'جارٍ تجهيز PDF…' : 'حفظ PDF'}</Button></Box>
    {message && <Alert severity="error">{message}</Alert>}
    <Dialog open={open} fullWidth maxWidth="lg" fullScreen={mobile} dir="rtl" onClose={() => setOpen(false)} aria-labelledby="document-preview-title">
      <DialogTitle id="document-preview-title">معاينة الطباعة</DialogTitle><DialogContent sx={{ p: 1 }}>{html.isPending ? <LoadingState /> : html.isError ? <ErrorState message={errorMessage(html.error)} onRetry={() => { void html.refetch(); }} /> : <iframe ref={frame} title="نسخة التقرير القابلة للطباعة" srcDoc={html.data} sandbox="allow-same-origin allow-modals" style={{ border: 0, width: '100%', height: '65vh' }} onLoad={() => { const document = frame.current?.contentDocument; if (document) void document.fonts.ready.then(() => setReady(true)); }} />}</DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>إغلاق</Button><Button variant="contained" disabled={!ready || html.isFetching} onClick={() => { void print(); }}>طباعة التقرير</Button></DialogActions>
    </Dialog>
  </Box>;
}
