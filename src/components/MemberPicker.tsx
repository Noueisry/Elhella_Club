import { Box, Checkbox, Chip, FormControlLabel, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { Member } from '../models/business';
import { useMembers } from '../hooks/use-business';
import { useDebounced } from '../hooks/use-debounced';
import { errorMessage } from '../services/auth.service';
import { formatCount } from '../utils/business-format';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { ListPagination, MemberBadge } from './BusinessUi';

export function MemberPicker({ selected, onChange, disabled = false }: { selected: Member[]; onChange: (members: Member[]) => void; disabled?: boolean }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [limit, setLimit] = useState(10);
  const debounced = useDebounced(search), query = useMembers({ search: debounced || undefined, page, limit, archived: 'exclude' });
  const waiting = search.trim() !== debounced;
  function toggle(member: Member) {
    onChange(selected.some((item) => item.id === member.id) ? selected.filter((item) => item.id !== member.id) : [...selected, member]);
  }
  return <Box component="fieldset" disabled={disabled} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, m: 0, minWidth: 0 }}>
    <Typography component="legend" variant="h3">المنتسبون المعنيون بالمساهمة</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>تُطلب المساهمة من المنتسبين الذين تختارهم فقط، بما فيهم غير النشطين. يمكن اختيار مائة منتسب في العملية الواحدة.</Typography>
    <TextField fullWidth size="small" label="البحث لاختيار المنتسبين" value={search} disabled={disabled} onChange={(event) => { setSearch(event.target.value); setPage(1); }} slotProps={{ htmlInput: { maxLength: 100 } }} />
    <Typography variant="body2" aria-live="polite" sx={{ my: 1.5 }}>تم اختيار <bdi>{formatCount(selected.length)}</bdi> منتسب</Typography>
    {selected.length > 0 && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>{selected.map((member) => <Chip key={member.id} size="small" label={member.fullName} onDelete={disabled ? undefined : () => toggle(member)} />)}</Box>}
    {waiting || query.isPending ? <LoadingState label="جارٍ تحميل المنتسبين…" /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <>
      {query.data.items.length ? <Box sx={{ display: 'grid' }}>{query.data.items.map((member) => {
        const checked = selected.some((item) => item.id === member.id);
        return <FormControlLabel key={member.id} sx={{ m: 0, py: 0.75, '& .MuiFormControlLabel-label': { width: '100%' } }}
          control={<Checkbox checked={checked} disabled={disabled || (!checked && selected.length >= 100)} onChange={() => toggle(member)} />}
          label={<Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}><Box>{member.fullName}<Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}><bdi dir="ltr">{member.membershipNumber}</bdi></Typography></Box><MemberBadge member={member} /></Box>} />;
      })}</Box> : <EmptyState title="لا توجد نتائج" description="غيّر البحث لاختيار منتسب آخر." />}
      <ListPagination page={page} limit={limit} total={query.data.total} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />
    </>}
  </Box>;
}
