import { useState } from 'react';
import { Box, Button, Card, TextField, Typography } from '@mui/material';
import { useMembers } from '../hooks/use-business';
import { useDebounced } from '../hooks/use-debounced';
import { errorMessage } from '../services/auth.service';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { MemberBadge, ListPagination } from './BusinessUi';
export function PaymentMemberSelect({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [limit, setLimit] = useState(10), debounced = useDebounced(search);
  const query = useMembers({ search: debounced || undefined, archived: 'include', page, limit });
  return <Card sx={{ p: 2.5 }}>
    <TextField fullWidth label="ابحث عن اسم المنتسب" helperText="يمكن البحث أيضاً برقم العضوية أو الهاتف، بما يشمل الملفات المؤرشفة." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} slotProps={{ htmlInput: { maxLength: 100 } }} />
    {query.isPending || search.trim() !== debounced ? <LoadingState /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /> : <>
      {query.data.items.length ? <Box sx={{ display: 'grid', gap: 1, mt: 2 }}>{query.data.items.map((member) => <Button key={member.id} variant="outlined" onClick={() => onSelect(member.id)} sx={{ justifyContent: 'space-between', gap: 1, textAlign: 'start', p: 1.5 }}>
        <Box>{member.fullName}<Typography component="span" variant="body2" sx={{ display: 'block' }}><bdi dir="ltr">{member.membershipNumber}</bdi></Typography></Box><MemberBadge member={member} />
      </Button>)}</Box> : <EmptyState title="لا توجد نتائج" description="غيّر الاسم أو الرقم أو الهاتف." />}
      <ListPagination {...query.data} onPage={setPage} onLimit={(value) => { setLimit(value); setPage(1); }} />
    </>}
  </Card>;
}
