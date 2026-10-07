import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, TextField, Typography } from '@mui/material';
import type { Settings } from '../models/administration';
import { useSettings, useRates } from '../hooks/use-administration';
import { useBusinessMutation } from '../hooks/use-business';
import { useNotify } from '../context/notification-context';
import { scheduleRate, updateSettings } from '../services/administration.service';
import { errorMessage } from '../services/auth.service';
import { civilDate, isPositiveMoney, normalizeInputDigits, validDate } from '../utils/business-format';
import { DataTable, ListPagination, Money, PageHeader } from '../components/BusinessUi';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';

function SettingsForm({ data }: { data: Settings }) {
  const notify = useNotify(), [name, setName] = useState(data.club.clubName), [timezone, setTimezone] = useState(data.club.businessTimezone);
  const [address, setAddress] = useState(data.club.receiptOptions?.address ?? ''), [phone, setPhone] = useState(data.club.receiptOptions?.phone ?? ''), [footer, setFooter] = useState(data.club.receiptOptions?.footer ?? ''), [error, setError] = useState('');
  const mutation = useBusinessMutation(() => updateSettings({ clubName: name.trim(), businessTimezone: timezone.trim(), receiptOptions: { address: address.trim() || null, phone: phone.trim() || null, footer: footer.trim() || null } }));
  async function save(e: FormEvent) { e.preventDefault(); if (name.trim().length < 2 || !timezone.trim()) { setError('أدخل اسم النادي والمنطقة الزمنية.'); return; } setError(''); try { await mutation.mutateAsync(); notify('تم حفظ إعدادات النادي. الإيصالات السابقة تحتفظ ببياناتها.'); } catch (failure) { setError(errorMessage(failure)); } }
  return <Card component="form" noValidate onSubmit={(e) => { void save(e); }} sx={{ p: 2.5, mb: 3 }}><Typography component="h2" variant="h2" sx={{ mb: 2 }}>هوية النادي وإعدادات الوصل</Typography>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Box sx={{ display: 'grid', gap: 2 }}>
    <TextField required label="اسم النادي" value={name} onChange={(e) => setName(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { maxLength: 200 } }} />
    <TextField required label="المنطقة الزمنية" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={mutation.isPending} helperText="صيغة IANA، مثلاً Africa/Nouakchott. تؤثر في تاريخ الاستحقاق والتقارير والتوليد الآلي." slotProps={{ htmlInput: { dir: 'ltr', maxLength: 100 } }} />
    <TextField label="عنوان النادي" value={address} onChange={(e) => setAddress(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { maxLength: 500 } }} />
    <TextField label="هاتف النادي" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 50 } }} />
    <TextField label="نص أسفل الوصل" multiline minRows={2} value={footer} onChange={(e) => setFooter(e.target.value)} disabled={mutation.isPending} slotProps={{ htmlInput: { maxLength: 1000 } }} />
    <Button type="submit" variant="contained" disabled={mutation.isPending}>حفظ الإعدادات</Button>
  </Box></Card>;
}
function Rates({ data }: { data: Settings }) {
  const notify = useNotify(), [page, setPage] = useState(1), [limit, setLimit] = useState(10), rates = useRates(page, limit), [amount, setAmount] = useState('');
  const today = data.businessToday, next = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  const [effective, setEffective] = useState(next.toISOString().slice(0, 10)), [error, setError] = useState(''), [review, setReview] = useState<{ amount: string; effectiveOn: string }>();
  const mutation = useBusinessMutation(scheduleRate);
  function prepare(e: FormEvent) { e.preventDefault(); setError(''); if (!isPositiveMoney(amount) || !validDate(effective) || !effective.endsWith('-01') || effective <= `${today.slice(0, 7)}-01`) { setError('أدخل مبلغاً موجباً وتاريخ بداية شهر مستقبلي.'); return; } setReview({ amount, effectiveOn: effective }); }
  return <Card sx={{ p: 2.5 }}><Typography component="h2" variant="h2">المساهمة الشهرية وتواريخ سريانها</Typography><Typography sx={{ my: 2 }}>التعريفة الحالية: {data.currentMonthlyRate ? <><Money value={data.currentMonthlyRate.amount} /> منذ <bdi>{civilDate(data.currentMonthlyRate.effectiveOn)}</bdi></> : 'غير محددة'}{data.nextMonthlyRate && <> · القادمة: <Money value={data.nextMonthlyRate.amount} /> من <bdi>{civilDate(data.nextMonthlyRate.effectiveOn)}</bdi></>}</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>التغيير يبدأ في أول يوم من شهر مستقبلي. لا يعيد كتابة الاستحقاقات السابقة؛ رَتْق الأشهر الناقصة يستخدم تعريفة كل شهر التاريخية. تسجيلات التعريفة مؤرخة ومدققة.</Alert>
    <Box component="form" noValidate className="filter-bar" onSubmit={prepare} sx={{ mb: 3 }}><TextField required label="المساهمة الشهرية الجديدة (MRU)" value={amount} onChange={(e) => setAmount(normalizeInputDigits(e.target.value))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'decimal', maxLength: 16 } }} /><TextField required label="تاريخ السريان" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button type="submit" variant="contained">مراجعة التعريفة الجديدة</Button></Box>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {rates.isPending ? <LoadingState /> : rates.isError ? <ErrorState message={errorMessage(rates.error)} onRetry={() => { void rates.refetch(); }} /> : <>{rates.data.items.length ? <DataTable label="تاريخ المساهمات الشهرية" rows={rates.data.items} columns={[{ key: 'amount', label: 'المبلغ', render: (row) => <Money value={row.amount} /> }, { key: 'date', label: 'من تاريخ', render: (row) => <bdi>{civilDate(row.effectiveOn)}</bdi> }]} /> : <EmptyState title="لا توجد تعريفات" description="حدد تعريفة مستقبلية." />}<ListPagination {...rates.data} onPage={setPage} onLimit={(v) => { setLimit(v); setPage(1); }} /></>}
    {review && <ConfirmDialog title="تأكيد تغيير المساهمة الشهرية" description={`التعريفة ${review.amount} MRU من ${civilDate(review.effectiveOn)}. الاستحقاقات المسجلة والإيصالات السابقة تبقى محفوظة.`} onClose={() => setReview(undefined)} onConfirm={async () => { await mutation.mutateAsync(review); setAmount(''); notify('تم تسجيل التعريفة المستقبلية.'); }} />}
  </Card>;
}
export function SettingsPage() {
  const query = useSettings();
  return <><PageHeader title="إعدادات النادي" back="/" description="هوية النادي، الوصل، المنطقة الزمنية والتعريفات المستقبلية." />{query.isPending ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <><SettingsForm data={query.data} /><Rates data={query.data} /><Alert severity="info" sx={{ mt: 3 }}>توليد المساهمات يعمل على الخادم بشكل مستقل عن المتصفح. إعادة التشغيل تستدرك الأشهر الناقصة دون تكرار. أوامر التشغيل ومتابعة الأخطاء متاحة لمسؤول التشغيل في دليل المشروع.</Alert><Button component={Link} to="/reports">عرض التقارير</Button></>}</>;
}
