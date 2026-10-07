import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useAuth } from '../context/auth-context';
import { errorMessage } from '../services/auth.service';

export function PasswordPage() {
  const auth = useAuth();
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!current || password.length < 12) { setError('أدخل كلمة المرور الحالية وكلمة مرور جديدة من 12 حرفاً على الأقل.'); return; }
    if (new TextEncoder().encode(password).length > 72) { setError('كلمة المرور الجديدة يجب ألا تتجاوز 72 بايت.'); return; }
    if (password !== confirmation) { setError('تأكيد كلمة المرور لا يطابق كلمة المرور الجديدة.'); return; }
    setPending(true);
    try { await auth.changePassword(current, password); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }
  return <Paper sx={{ maxWidth: 600, p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
    <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>تغيير كلمة المرور</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>بعد الحفظ، تُلغى جلسات حسابك ويلزم تسجيل الدخول من جديد.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box component="form" noValidate onSubmit={(event) => { void submit(event); }} sx={{ display: 'grid', gap: 2.5 }}>
      <TextField label="كلمة المرور الحالية" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required disabled={pending} slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'current-password' } }} />
      <TextField label="كلمة المرور الجديدة" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'new-password' } }} />
      <TextField label="تأكيد كلمة المرور الجديدة" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={pending} slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'new-password' } }} />
      <Button variant="contained" type="submit" disabled={pending}>{pending ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</Button>
    </Box>
  </Paper>;
}
