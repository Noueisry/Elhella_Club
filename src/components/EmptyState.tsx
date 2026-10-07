import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InboxOutlined from '@mui/icons-material/InboxOutlined';

export function EmptyState({
  title = 'لا توجد بيانات للعرض',
  description = 'ستظهر البيانات هنا عند توفرها.',
  action,
}: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 5, md: 7 }, px: 3 }}>
      <Box sx={{ width: 68, height: 68, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#f1f5ee', color: '#71866f', mx: 'auto', mb: 2 }}>
        <InboxOutlined sx={{ fontSize: 30 }} />
      </Box>
      <Typography variant="h3" component="h2">{title}</Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 1, mb: action ? 3 : 0 }}>{description}</Typography>
      {action}
    </Box>
  );
}
