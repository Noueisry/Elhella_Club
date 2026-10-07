import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, useMediaQuery, useTheme } from '@mui/material';
import type { Member, MemberInput, MemberStatus } from '../models/business';
import { useBusinessMutation } from '../hooks/use-business';
import { createMember, updateMember } from '../services/business.service';
import { errorMessage } from '../services/auth.service';
import { useNotify } from '../context/notification-context';
import { normalizeInputDigits, validDate } from '../utils/business-format';

export function MemberFormDialog({ member, onClose, onSaved }: { member?: Member; onClose: () => void; onSaved: (id: string) => void }) {
  const [input, setInput] = useState<MemberInput>({ fullName: member?.fullName ?? '', phone: member?.phone ?? '', membershipNumber: member?.membershipNumber ?? '', joinedOn: member?.joinedOn ?? '', status: member?.status ?? 'active', notes: member?.notes ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useBusinessMutation((value: MemberInput) => member ? updateMember(member.id, { fullName: value.fullName, phone: value.phone, membershipNumber: value.membershipNumber, notes: value.notes }) : createMember(value));
  const notify = useNotify(), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  function field(name: keyof MemberInput, value: string) { setInput((previous) => ({ ...previous, [name]: value })); setErrors((previous) => ({ ...previous, [name]: '' })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); mutation.reset();
    const invalid: Record<string, string> = {}, value = { ...input, fullName: input.fullName.trim(), membershipNumber: input.membershipNumber.trim(), phone: normalizeInputDigits(input.phone.trim()), notes: input.notes?.trim() || null };
    if (value.fullName.length < 2 || value.fullName.length > 200) invalid.fullName = 'أدخل اسماً من حرفين إلى مائتي حرف.';
    if (!/^\+?[0-9][0-9 ()-]{5,30}[0-9]$/.test(value.phone)) invalid.phone = 'أدخل رقم هاتف صالحاً.';
    if (!value.membershipNumber || value.membershipNumber.length > 50) invalid.membershipNumber = 'أدخل رقم عضوية لا يتجاوز خمسين حرفاً.';
    if (!validDate(value.joinedOn) || value.joinedOn < '1900-01-01') invalid.joinedOn = 'أدخل تاريخ انضمام صالحاً.';
    if ((value.notes?.length ?? 0) > 5000) invalid.notes = 'الملاحظات طويلة جداً.';
    setErrors(invalid); if (Object.keys(invalid).length) return;
    try { const result = await mutation.mutateAsync(value); notify(member ? 'تم تعديل بيانات المنتسب.' : 'تمت إضافة المنتسب وإنشاء استحقاقاته.'); onSaved(result.member.id); }
    catch { /* The server's Arabic validation is rendered below. */ }
  }
  return <Dialog dir="rtl" open fullScreen={mobile} fullWidth maxWidth="sm" onClose={() => { if (!mutation.isPending) onClose(); }} aria-labelledby="member-form-title">
    <Box component="form" noValidate onSubmit={(event) => { void submit(event); }} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DialogTitle id="member-form-title">{member ? 'تعديل بيانات المنتسب' : 'إضافة منتسب'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '16px !important' }}>
        {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        <TextField autoFocus required label="الاسم الكامل" value={input.fullName} disabled={mutation.isPending} onChange={(event) => field('fullName', event.target.value)} error={Boolean(errors.fullName)} helperText={errors.fullName} slotProps={{ htmlInput: { maxLength: 200, autoComplete: 'name' } }} />
        <TextField required label="رقم الهاتف" value={input.phone} disabled={mutation.isPending} onChange={(event) => field('phone', event.target.value)} error={Boolean(errors.phone)} helperText={errors.phone} slotProps={{ htmlInput: { maxLength: 32, dir: 'ltr', inputMode: 'tel', autoComplete: 'tel' } }} />
        <TextField required label="رقم العضوية" value={input.membershipNumber} disabled={mutation.isPending} onChange={(event) => field('membershipNumber', event.target.value)} error={Boolean(errors.membershipNumber)} helperText={errors.membershipNumber} slotProps={{ htmlInput: { maxLength: 50, dir: 'ltr' } }} />
        <TextField required type="date" label="تاريخ الانضمام" value={input.joinedOn} disabled={Boolean(member) || mutation.isPending} onChange={(event) => field('joinedOn', event.target.value)} error={Boolean(errors.joinedOn)} helperText={errors.joinedOn || (member ? 'تاريخ الانضمام محفوظ لحماية الاستحقاقات السابقة.' : 'يُحتسب شهر الانضمام كاملاً. اختر تاريخاً لا يتجاوز اليوم.')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', min: '1900-01-01' } }} />
        {!member && <TextField select label="الحالة" value={input.status} disabled={mutation.isPending} onChange={(event) => field('status', event.target.value as MemberStatus)} helperText="المنتسب غير النشط لا تُنشأ له استحقاقات شهرية عند إضافته."><MenuItem value="active">نشط</MenuItem><MenuItem value="inactive">غير نشط</MenuItem></TextField>}
        <TextField label="ملاحظات" multiline minRows={2} value={input.notes ?? ''} disabled={mutation.isPending} onChange={(event) => field('notes', event.target.value)} error={Boolean(errors.notes)} helperText={errors.notes} slotProps={{ htmlInput: { maxLength: 5000 } }} />
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={onClose}>إلغاء</Button><Button type="submit" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ المنتسب'}</Button></DialogActions>
    </Box>
  </Dialog>;
}
