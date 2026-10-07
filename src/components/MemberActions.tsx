import { useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import type { Member } from '../models/business';
import { useAuth } from '../context/auth-context';
import { useNotify } from '../context/notification-context';
import { useBusinessMutation } from '../hooks/use-business';
import { archiveMember, changeActivity, removeMember } from '../services/business.service';
import { MemberFormDialog } from './MemberFormDialog';
import { ConfirmDialog } from './ConfirmDialog';

export function MemberActions({ member, onRemoved }: { member: Member; onRemoved?: () => void }) {
  const { user } = useAuth(), notify = useNotify();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null), [action, setAction] = useState('');
  const activity = useBusinessMutation(() => changeActivity(member.id, member.status === 'active' ? 'inactive' : 'active'));
  const removal = useBusinessMutation(() => removeMember(member.id)), archive = useBusinessMutation(() => archiveMember(member.id));
  if (!user?.permissions.includes('members.manage') || member.archivedAt) return null;
  function choose(value: string) { setAnchor(null); setAction(value); }
  return <>
    <Button size="small" onClick={(event) => setAnchor(event.currentTarget)} aria-label={`إجراءات ${member.fullName}`} aria-haspopup="menu" aria-expanded={Boolean(anchor)}>إجراءات</Button>
    <Menu dir="rtl" anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
      <MenuItem onClick={() => choose('edit')}>تعديل البيانات</MenuItem>
      <MenuItem onClick={() => choose('activity')}>{member.status === 'active' ? 'إيقاف النشاط' : 'تفعيل المنتسب'}</MenuItem>
      <MenuItem onClick={() => choose('archive')}>أرشفة المنتسب</MenuItem>
      <MenuItem onClick={() => choose('remove')}>حذف أو أرشفة</MenuItem>
    </Menu>
    {action === 'edit' && <MemberFormDialog member={member} onClose={() => setAction('')} onSaved={() => setAction('')} />}
    {action === 'activity' && <ConfirmDialog title={member.status === 'active' ? 'إيقاف نشاط المنتسب' : 'تفعيل المنتسب'}
      description={member.status === 'active' ? 'يتوقف إنشاء الاستحقاقات الجديدة بعد اليوم. تبقى الديون السابقة محفوظة، ويمكن إعادة التفعيل لاحقاً.' : 'يُستأنف النشاط من اليوم، وتُنشأ الاستحقاقات الجديدة وفق فترات النشاط دون تكرار.'}
      onClose={() => setAction('')} onConfirm={async () => { await activity.mutateAsync(); notify('تم تحديث حالة النشاط.'); }} />}
    {(action === 'archive' || action === 'remove') && <ConfirmDialog title={action === 'archive' ? 'أرشفة المنتسب' : 'حذف أو أرشفة المنتسب'}
      description={action === 'archive' ? 'تُحفظ جميع الاستحقاقات والدفعات، وتبقى الديون قابلة للتسديد. الأرشفة نهائية ولا يمكن إعادة تفعيل هذا الملف.' : 'يُحذف الملف نهائياً فقط إذا لم يكن له تاريخ مالي أو روابط تمنع الحذف. خلاف ذلك يُؤرشف مع حفظ جميع الديون والدفعات. الأرشفة نهائية.'}
      onClose={() => setAction('')} onConfirm={async () => { const result = await (action === 'archive' ? archive.mutateAsync() : removal.mutateAsync()); notify(result.action === 'deleted' ? 'تم حذف المنتسب دون تاريخ مالي.' : 'تمت أرشفة المنتسب وحفظ تاريخه المالي.'); if (result.action === 'deleted') onRemoved?.(); }} />}
  </>;
}
