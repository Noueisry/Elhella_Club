import { useState } from 'react';
import { Box, Button, Card, Dialog, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import type { ReportKind, ReportQuery } from '../models/report';
import { reportTitles } from '../models/report';
import { useEvents } from '../hooks/use-business';
import { useDebounced } from '../hooks/use-debounced';
import { PaymentMemberSelect } from './PaymentMemberSelect';
import { ListPagination } from './BusinessUi';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { errorMessage } from '../services/auth.service';
export function ReportFilters({ kind, input, onKind, onChange, individual = false, memberName, eventName }: { kind: ReportKind; input: ReportQuery; onKind: (value: ReportKind) => void; onChange: (key: keyof ReportQuery, value: string) => void; individual?: boolean; memberName?: string; eventName?: string }) {
  const [picker, setPicker] = useState<'member' | 'event' | ''>(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [limit, setLimit] = useState(10), debounced = useDebounced(search);
  const events = useEvents({ search: debounced || undefined, page, limit }, picker === 'event');
  return <Card sx={{ p: 2.5, mb: 3 }}>
    <Box className="filter-bar">
      {!individual && <TextField select label="نوع التقرير" value={kind} onChange={(e) => onKind(e.target.value as ReportKind)} sx={{ flex: '1 1 200px' }}>{Object.entries(reportTitles).map(([value, title]) => <MenuItem key={value} value={value}>{title}</MenuItem>)}</TextField>}
      {kind === 'daily' && <TextField label="يوم التقرير" type="date" value={input.date ?? ''} onChange={(e) => onChange('date', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
      {kind === 'monthly' && <TextField label="شهر التقرير" type="month" value={input.month ?? ''} onChange={(e) => onChange('month', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}
      {kind === 'annual' && <TextField label="سنة التقرير" type="number" value={input.year ?? ''} onChange={(e) => onChange('year', e.target.value)} slotProps={{ htmlInput: { min: 1900, max: 9998, dir: 'ltr' } }} />}
      {['events', 'arrears', 'statement'].includes(kind) && <><TextField label="من تاريخ" type="date" value={input.from ?? ''} onChange={(e) => onChange('from', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="إلى تاريخ" type="date" value={input.to ?? ''} onChange={(e) => onChange('to', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></>}
      <TextField label="الوضعية حتى تاريخ" type="date" value={input.asOf ?? ''} onChange={(e) => onChange('asOf', e.target.value)} helperText="فارغ: اليوم أو نهاية الفترة السابقة." slotProps={{ inputLabel: { shrink: true } }} />
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>{!individual && <><Button variant="outlined" onClick={() => setPicker('member')}>{input.memberId ? memberName ?? 'المنتسب المحدد' : 'اختيار منتسب'}</Button>{input.memberId && <Button onClick={() => onChange('memberId', '')}>كل المنتسبين</Button>}<Button variant="outlined" onClick={() => setPicker('event')}>{input.eventId ? eventName ?? 'الدورة المحددة' : 'اختيار دورة'}</Button>{input.eventId && <Button onClick={() => onChange('eventId', '')}>كل الدورات</Button>}</>}</Box>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>الأرقام عند تاريخ الوضعية تشمل فقط الكتابات المعروفة عند الإقفال. الإلغاء أو التسجيل اللاحق لا يغيّر الحالة السابقة. تصفية فترة التحصيل لا تُسقط الديون الأقدم من إجمالي المتأخرات.</Typography>
    <Dialog open={Boolean(picker)} fullWidth maxWidth="sm" dir="rtl" onClose={() => setPicker('')} aria-labelledby="report-picker-title"><DialogTitle id="report-picker-title">{picker === 'member' ? 'اختيار منتسب للتقرير' : 'اختيار دورة للتقرير'}</DialogTitle><DialogContent>{picker === 'member' ? <PaymentMemberSelect onSelect={(id) => { onChange('memberId', id); setPicker(''); }} /> : <>
      <TextField fullWidth label="البحث في الدورات" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {events.isPending || search.trim() !== debounced ? <LoadingState /> : events.isError ? <ErrorState message={errorMessage(events.error)} onRetry={() => { void events.refetch(); }} /> : <><Box sx={{ display: 'grid', gap: 1, my: 2 }}>{events.data.items.length ? events.data.items.map((event) => <Button key={event.id} variant="outlined" onClick={() => { onChange('eventId', event.id); setPicker(''); }}>{event.name}</Button>) : <Typography>لا توجد دورات مطابقة.</Typography>}</Box><ListPagination {...events.data} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} /></>}
    </>}</DialogContent></Dialog>
  </Card>;
}
