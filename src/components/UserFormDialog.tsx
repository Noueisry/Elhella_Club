import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, useMediaQuery, useTheme } from '@mui/material';
import type { ManagedUser, UserInput } from '../models/administration';
import { useAuth } from '../context/auth-context';
import { useNotify } from '../context/notification-context';
import { useBusinessMutation } from '../hooks/use-business';
import { createUser, updateUser, resetUserPassword } from '../services/administration.service';
import { errorMessage } from '../services/auth.service';

export function UserFormDialog({ user, reset = false, onClose }: { user?: ManagedUser; reset?: boolean; onClose: () => void }) {
  const auth = useAuth(), notify = useNotify(), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [name, setName] = useState(user?.fullName ?? ''), [login, setLogin] = useState(''), [password, setPassword] = useState(''), [role, setRole] = useState<UserInput['role']>(user?.role ?? 'treasurer'), [error, setError] = useState('');
  const mutation = useBusinessMutation(async () => reset ? resetUserPassword(user!.id, password) : user ? updateUser(user.id, { fullName: name.trim(), role }) : createUser({ login, fullName: name.trim(), password, role }));
  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!reset && (name.trim().length < 2 || !user && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,99}$/.test(login))) { setError('أدخل اسماً كاملاً واسم دخول من 3 إلى 100 حرف أو رقم دون مسافات.'); return; }
    if ((reset || !user) && (password.length < 12 || new TextEncoder().encode(password).length > 72)) { setError('كلمة المرور من 12 حرفاً على الأقل، ولا تتجاوز 72 بايت.'); return; }
    try { await mutation.mutateAsync(); notify(reset ? 'تم تغيير كلمة المرور وإلغاء الجلسات السابقة.' : 'تم حفظ المستخدم.'); if (user?.id === auth.user?.id) await auth.restore(); onClose(); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  return <Dialog open fullWidth maxWidth="sm" fullScreen={mobile} dir="rtl" onClose={() => { if (!mutation.isPending) onClose(); }} aria-labelledby="user-form-title">
    <Box component="form" noValidate onSubmit={(e) => { void save(e); }} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: mobile ? '100%' : undefined }}>
      <DialogTitle id="user-form-title">{reset ? 'إعادة تعيين كلمة المرور' : user ? 'تعديل المستخدم' : 'إضافة مستخدم'}</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!reset && <><TextField label="الاسم الكامل" required value={name} onChange={(e) => setName(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { maxLength: 200 } }} />{!user && <TextField label="اسم الدخول" required value={login} onChange={(e) => setLogin(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 100, autoComplete: 'off' } }} />}<TextField select label="صلاحية المستخدم" value={role} disabled={mutation.isPending || user?.id === auth.user?.id} onChange={(e) => setRole(e.target.value as typeof role)} helperText={user?.id === auth.user?.id ? 'لا يمكنك تغيير صلاحيتك بنفسك.' : 'تغيير الصلاحية يلغي جميع جلسات الحساب.'}><MenuItem value="admin">مدير النادي</MenuItem><MenuItem value="treasurer">أمين الصندوق</MenuItem></TextField></>}
        {(reset || !user) && <TextField label="كلمة المرور الجديدة" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={mutation.isPending} helperText="12 حرفاً على الأقل، 72 بايت كحد أقصى." slotProps={{ htmlInput: { dir: 'ltr', autoComplete: 'new-password' } }} />}
        {reset && <Alert severity="warning">تُلغى جميع جلسات هذا المستخدم بعد الحفظ. أخبره بكلمة المرور الجديدة عبر وسيلة تختارها؛ لا يرسل التطبيق أي رسالة.</Alert>}
      </DialogContent><DialogActions><Button disabled={mutation.isPending} onClick={onClose}>إلغاء</Button><Button type="submit" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ المستخدم'}</Button></DialogActions>
    </Box>
  </Dialog>;
}
