import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, useMediaQuery, useTheme } from '@mui/material';
import type { ClubEvent, EventUpdate, Member } from '../models/business';
import { useBusinessMutation } from '../hooks/use-business';
import { createEvent, updateEvent } from '../services/business.service';
import { errorMessage } from '../services/auth.service';
import { useNotify } from '../context/notification-context';
import { normalizeInputDigits, isPositiveMoney, validDate } from '../utils/business-format';
import { MemberPicker } from './MemberPicker';

export function EventFormDialog({ event, onClose, onSaved }: { event?: ClubEvent; onClose: () => void; onSaved: (id: string) => void }) {
  const [input, setInput] = useState<EventUpdate>({ name: event?.name ?? '', type: event?.type ?? '', eventOn: event?.eventOn ?? '', contributionAmount: event?.contributionAmount ?? '', notes: event?.notes ?? '' });
  const [selected, setSelected] = useState<Member[]>([]), [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useBusinessMutation((value: EventUpdate) => event ? updateEvent(event.id, value) : createEvent({ ...value, memberIds: selected.map((member) => member.id) }));
  const notify = useNotify(), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  function field(name: keyof EventUpdate, value: string) { setInput((previous) => ({ ...previous, [name]: value })); setErrors((previous) => ({ ...previous, [name]: '' })); }
  async function submit(form: FormEvent) {
    form.preventDefault(); mutation.reset();
    const invalid: Record<string, string> = {}, value = { ...input, name: input.name.trim(), type: input.type.trim(), contributionAmount: normalizeInputDigits(input.contributionAmount.trim()), notes: input.notes?.trim() || null };
    if (value.name.length < 2 || value.name.length > 200) invalid.name = 'أدخل اسماً من حرفين إلى مائتي حرف.';
    if (!value.type || value.type.length > 80) invalid.type = 'أدخل نوع الدورة، في حدود ثمانين حرفاً.';
    if (!validDate(value.eventOn)) invalid.eventOn = 'أدخل تاريخ دورة صالحاً.';
    if (!isPositiveMoney(value.contributionAmount) || !/^\d{1,12}(?:\.\d{1,2})?$/.test(value.contributionAmount)) invalid.contributionAmount = 'أدخل مبلغاً موجباً، بدقة منزلتين عشريتين كحد أقصى.';
    if ((value.notes?.length ?? 0) > 5000) invalid.notes = 'الملاحظات طويلة جداً.';
    setErrors(invalid); if (Object.keys(invalid).length) return;
    try { const result = await mutation.mutateAsync(value); notify(event ? 'تم تعديل الدورة مع حفظ الاستحقاقات السابقة.' : 'تم إنشاء الدورة ومساهمات المنتسبين المختارين.'); onSaved(result.event.id); }
    catch { /* Preserve the form and render the Arabic server error. */ }
  }
  return <Dialog dir="rtl" open fullScreen={mobile} fullWidth maxWidth="md" onClose={() => { if (!mutation.isPending) onClose(); }} aria-labelledby="event-form-title">
    <Box component="form" noValidate onSubmit={(form) => { void submit(form); }} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DialogTitle id="event-form-title">{event ? 'تعديل الدورة' : 'إضافة دورة'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '16px !important' }}>
        {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        {event && <Alert severity="info">تعديل المبلغ أو الاسم أو التاريخ يخص المساهمات الجديدة. استحقاقات المشاركين الحاليين تبقى محفوظة كما أُنشئت.</Alert>}
        <TextField autoFocus required label="اسم الدورة" value={input.name} disabled={mutation.isPending} onChange={(form) => field('name', form.target.value)} error={Boolean(errors.name)} helperText={errors.name} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <Box className="filter-bar">
          <TextField required label="نوع الدورة" value={input.type} disabled={mutation.isPending} onChange={(form) => field('type', form.target.value)} error={Boolean(errors.type)} helperText={errors.type} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ flex: '1 1 180px' }} />
          <TextField required label="تاريخ الدورة" type="date" value={input.eventOn} disabled={mutation.isPending} onChange={(form) => field('eventOn', form.target.value)} error={Boolean(errors.eventOn)} helperText={errors.eventOn} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 180px' }} />
          <TextField required label={<>مساهمة المنتسب (<bdi dir="ltr">MRU</bdi>)</>} value={input.contributionAmount} disabled={mutation.isPending} onChange={(form) => field('contributionAmount', form.target.value)} error={Boolean(errors.contributionAmount)} helperText={errors.contributionAmount || 'المبلغ المطلوب من كل منتسب مختار.'} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', maxLength: 15 } }} sx={{ flex: '1 1 180px' }} />
        </Box>
        <TextField label="ملاحظات" multiline minRows={2} value={input.notes ?? ''} disabled={mutation.isPending} onChange={(form) => field('notes', form.target.value)} error={Boolean(errors.notes)} helperText={errors.notes} slotProps={{ htmlInput: { maxLength: 5000 } }} />
        {!event && <MemberPicker selected={selected} onChange={setSelected} disabled={mutation.isPending} />}
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={onClose}>إلغاء</Button><Button type="submit" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ الدورة'}</Button></DialogActions>
    </Box>
  </Dialog>;
}
