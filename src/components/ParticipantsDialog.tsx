import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from '@mui/material';
import type { Member } from '../models/business';
import { useBusinessMutation } from '../hooks/use-business';
import { addParticipants } from '../services/business.service';
import { errorMessage } from '../services/auth.service';
import { useNotify } from '../context/notification-context';
import { formatCount } from '../utils/business-format';
import { MemberPicker } from './MemberPicker';

export function ParticipantsDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<Member[]>([]);
  const mutation = useBusinessMutation((ids: string[]) => addParticipants(eventId, ids));
  const notify = useNotify(), mobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { const result = await mutation.mutateAsync(selected.map((member) => member.id)); notify(`تمت إضافة ${formatCount(result.contributionsCreated)} مساهمة جديدة.`); onClose(); }
    catch { /* Server validation is displayed within the dialog. */ }
  }
  return <Dialog dir="rtl" open fullScreen={mobile} maxWidth="sm" fullWidth onClose={() => { if (!mutation.isPending) onClose(); }} aria-labelledby="participants-title">
    <Box component="form" onSubmit={(event) => { void submit(event); }} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DialogTitle id="participants-title">إضافة منتسبين للدورة</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <Alert severity="info">تُنشأ مساهمة جديدة بالتعريفة الحالية للدورة. المنتسبون المسجلون فيها سابقاً لا تتكرر استحقاقاتهم.</Alert>
        {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        <MemberPicker selected={selected} onChange={setSelected} disabled={mutation.isPending} />
      </DialogContent>
      <DialogActions><Button disabled={mutation.isPending} onClick={onClose}>إلغاء</Button><Button type="submit" variant="contained" disabled={!selected.length || mutation.isPending}>{mutation.isPending ? 'جارٍ الإضافة…' : 'إضافة المختارين'}</Button></DialogActions>
    </Box>
  </Dialog>;
}
