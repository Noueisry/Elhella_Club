import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Card, Chip, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import type { Member, Obligation } from '../models/business';
import { formatCount, formatMoney } from '../utils/business-format';
import { useAuth } from '../context/auth-context';

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: string }) {
  return <Box sx={{ mb: 3 }}>
    {back && <Button component={Link} to={back} startIcon={<ArrowForwardOutlined />} size="small" sx={{ mb: 1 }}>العودة إلى القائمة</Button>}
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}><Typography component="h1" variant="h1" sx={{ fontSize: { xs: '1.65rem', md: '2rem' }, overflowWrap: 'anywhere' }}>{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>}</Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
    </Box>
  </Box>;
}
export function Money({ value }: { value: string }) { return <bdi dir="ltr" className="money">{formatMoney(value)}</bdi>; }
export function Metrics({ items }: { items: { label: string; value: string | number; hint?: ReactNode }[] }) {
  return <Box className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3" sx={{ mb: 3 }}>
    {items.map((item) => <Card key={item.label} sx={{ p: 2.5, minWidth: 0 }}>
      <Typography color="text.secondary" variant="body2">{item.label}</Typography>
      <Typography component="div" sx={{ fontSize: { xs: '1.2rem', md: '1.4rem' }, fontWeight: 700, mt: 1, overflowWrap: 'anywhere' }}>
        {typeof item.value === 'number' ? <bdi>{formatCount(item.value)}</bdi> : <Money value={item.value} />}
      </Typography>{item.hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{item.hint}</Typography>}
    </Card>)}
  </Box>;
}
export interface Column<T> { key: string; label: string; render: (row: T) => ReactNode }
export function DataTable<T extends { id: string }>({ label, rows, columns }: { label: string; rows: T[]; columns: Column<T>[] }) {
  return <TableContainer tabIndex={0} role="region" aria-label={label} sx={{ maxWidth: '100%', '&:focus-visible': { outline: '2px solid #173f3b', outlineOffset: -2 } }}>
    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, px: 2, py: 1 }}>مرّر الجدول أفقياً لعرض جميع الأعمدة.</Typography>
    <Table size="small" aria-label={label} sx={{ minWidth: 560, '& th': { bgcolor: '#f3f6f0', fontWeight: 700 }, '& td, & th': { py: 1.8 }, '& td': { verticalAlign: 'top' } }}>
      <TableHead><TableRow>{columns.map((column) => <TableCell key={column.key} scope="col">{column.label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map((row) => <TableRow key={row.id} hover>{columns.map((column) => <TableCell key={column.key}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  </TableContainer>;
}
export function ListPagination({ page, limit, total, onPage, onLimit }: { page: number; limit: number; total: number; onPage: (page: number) => void; onLimit: (limit: number) => void }) {
  const last = Math.max(1, Math.ceil(total / limit));
  return <Box aria-label="ترقيم الصفحات" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderTop: '1px solid', borderColor: 'divider' }}>
    <Typography variant="body2" sx={{ flex: 1 }}>عدد النتائج: <bdi>{formatCount(total)}</bdi> · الصفحة <bdi>{formatCount(page)}</bdi> من <bdi>{formatCount(last)}</bdi></Typography>
    <TextField select size="small" label="نتائج الصفحة" value={limit} onChange={(event) => onLimit(Number(event.target.value))} sx={{ minWidth: 110 }}>
      {[10, 25, 50].map((size) => <MenuItem key={size} value={size}><bdi>{formatCount(size)}</bdi></MenuItem>)}
    </TextField>
    <Button size="small" disabled={page <= 1} onClick={() => onPage(page - 1)}>السابق</Button>
    <Button size="small" disabled={page >= last} onClick={() => onPage(page + 1)}>التالي</Button>
  </Box>;
}
export function MemberBadge({ member }: { member: Pick<Member, 'archivedAt' | 'status'> }) {
  return <Chip size="small" label={member.archivedAt ? 'مؤرشف' : member.status === 'active' ? 'نشط' : 'غير نشط'} color={!member.archivedAt && member.status === 'active' ? 'success' : 'default'} variant="outlined" />;
}
export function PaymentState({ row }: { row: Obligation }) {
  return <Box sx={{ display: 'grid', gap: 0.75, justifyItems: 'start' }}>
    <Chip size="small" variant="outlined" color={row.paymentStatus === 'paid' ? 'success' : row.isOverdue ? 'warning' : 'default'} label={row.paymentStatusLabel} />
    {row.paymentStatus !== 'paid' && <Typography variant="body2" color={row.isOverdue ? 'warning.main' : 'text.secondary'}>{row.dueStatusLabel}</Typography>}
  </Box>;
}
export function PaymentLink({ memberId, compact = false }: { memberId?: string; compact?: boolean }) {
  const { user } = useAuth();
  if (!user?.permissions.includes('payments.create')) return null;
  return <Button component={Link} to={`/payments/new${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''}`} variant={compact ? 'text' : 'contained'} size={compact ? 'small' : 'medium'} startIcon={<AddOutlined />}>تسجيل دفعة</Button>;
}
