import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingState({ label = 'جارٍ تحميل البيانات...' }: { label?: string }) {
  return (
    <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
      <CircularProgress size={22} aria-label={label} />
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}
