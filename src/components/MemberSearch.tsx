import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Box, Card, List, ListItemButton, ListItemText, TextField, Typography } from '@mui/material';
import { useMembers } from '../hooks/use-business';
import { useDebounced } from '../hooks/use-debounced';
import { errorMessage } from '../services/auth.service';
import { formatCount } from '../utils/business-format';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { MemberBadge } from './BusinessUi';

export function MemberSearch() {
  const [search, setSearch] = useState(''), debounced = useDebounced(search);
  const query = useMembers({ search: debounced || undefined, archived: 'include', page: 1, limit: 8 }, Boolean(debounced));
  const waiting = search.trim() !== debounced;
  return <Card component="section" aria-label="البحث عن المنتسب" sx={{ mb: 3, p: { xs: 2, md: 3 } }}>
    <Typography component="h2" variant="h2" sx={{ mb: 2 }}>الوضعية المالية، في لحظات</Typography>
    <TextField fullWidth label="ابحث عن اسم المنتسب" placeholder="الاسم أو رقم العضوية أو الهاتف" value={search} onChange={(event) => setSearch(event.target.value)}
      slotProps={{ htmlInput: { maxLength: 100, autoComplete: 'off', 'aria-controls': 'member-search-results' } }} helperText="اختر المنتسب لفتح كشف حسابه. يشمل البحث الملفات المؤرشفة." />
    <Box id="member-search-results" aria-live="polite" aria-busy={waiting || query.isFetching}>
      {search.trim() && (waiting || query.isPending) ? <LoadingState label="جارٍ البحث…" /> : null}
      {!waiting && debounced && query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} />}
      {!waiting && debounced && query.data && <>
        {query.data.items.length ? <List>{query.data.items.map((member) => <ListItemButton key={member.id} component={Link} to={`/members/${member.id}`} sx={{ borderRadius: 2, gap: 2 }}>
          <ListItemText primary={member.fullName} secondary={<><bdi dir="ltr">{member.membershipNumber}</bdi> · <bdi dir="ltr">{member.phone}</bdi></>} />
          <MemberBadge member={member} />
        </ListItemButton>)}</List> : <EmptyState title="لا توجد نتائج" description="جرّب اسماً آخر أو رقم العضوية أو الهاتف." />}
        {query.data.total > query.data.items.length && <Typography variant="body2" component={Link} to={`/members?search=${encodeURIComponent(debounced)}&archived=include`}>عرض جميع النتائج (<bdi>{formatCount(query.data.total)}</bdi>)</Typography>}
      </>}
    </Box>
  </Card>;
}
