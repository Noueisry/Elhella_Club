import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import { useAuth } from '../context/auth-context';
import { homeFor } from '../models/auth';
import { mayRestoreRoute } from '../utils/route-permission';
import { errorMessage } from '../services/auth.service';
import { ClubMark } from '../components/ClubMark';
import { LoadingState } from '../components/LoadingState';

export function LoginPage() {
  const auth = useAuth(), location = useLocation();
  const [login, setLogin] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [pending, setPending] = useState(false);
  if (auth.status === 'loading') return <LoadingState />;
  if (auth.user) {
    const user = auth.user;
    const from = (location.state as { from?: unknown } | null)?.from;
    const destination = mayRestoreRoute(from, user.permissions) ? from : homeFor(user);
    return <Navigate to={destination} replace />;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!login.trim() || !password) { setError('أدخل اسم الدخول وكلمة المرور.'); return; }
    setPending(true);
    try {
      await auth.login(login.trim(), password); setPassword('');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }
  return <Box component="main" sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 5, background: 'radial-gradient(ellipse at top, #e5efe8, #f8f7f2 70%)' }}>
    <Paper sx={{ width: '100%', maxWidth: 450, p: { xs: 3, sm: 4.5 }, borderRadius: 4 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 4 }}><ClubMark /><Box>
        <Typography sx={{ fontWeight: 700 }}>نادي الرماية التقليدية</Typography>
        <Typography variant="body2" color="text.secondary">إدارة المنتسبين والمساهمات</Typography>
      </Box></Box>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>تسجيل الدخول</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>أدخل بيانات حسابك للوصول إلى مساحة النادي.</Typography>
      {auth.notice && <Alert severity="info" sx={{ mb: 2 }}>{auth.notice}</Alert>}
      {auth.status === 'error' && <Alert severity="warning" sx={{ mb: 2 }}>{auth.error}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" noValidate onSubmit={(event) => { void submit(event); }} sx={{ display: 'grid', gap: 2.5 }}>
        <TextField label="اسم الدخول" value={login} onChange={(event) => setLogin(event.target.value)} required disabled={pending} slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'username', maxLength: 100 } }} />
        <TextField label="كلمة المرور" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={pending} slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'current-password' } }} />
        <Button type="submit" variant="contained" size="large" disabled={pending} startIcon={<LoginOutlined />} sx={{ py: 1.4 }}>{pending ? 'جارٍ تسجيل الدخول…' : 'دخول'}</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center', lineHeight: 2 }}>لإنشاء حساب أو استعادة الوصول، تواصل مع مدير النادي.</Typography>
    </Paper>
  </Box>;
}
