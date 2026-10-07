import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { errorMessage } from '../services/auth.service';

export function ConfirmDialog({ title, description, confirmLabel = 'تأكيد', onClose, onConfirm }: {
  title: string; description: string; confirmLabel?: string; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function confirm() {
    setPending(true); setError('');
    try { await onConfirm(); onClose(); }
    catch (failure) { setError(errorMessage(failure)); setPending(false); }
  }
  return <Dialog dir="rtl" open onClose={() => { if (!pending) onClose(); }} aria-labelledby="confirmation-title" aria-describedby="confirmation-description" maxWidth="sm" fullWidth>
    <DialogTitle id="confirmation-title">{title}</DialogTitle>
    <DialogContent><DialogContentText id="confirmation-description">{description}</DialogContentText>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}</DialogContent>
    <DialogActions><Button disabled={pending} onClick={onClose}>إلغاء</Button><Button variant="contained" color="warning" disabled={pending} onClick={() => { void confirm(); }}>{pending ? 'جارٍ التنفيذ…' : confirmLabel}</Button></DialogActions>
  </Dialog>;
}
