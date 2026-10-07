import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { useServiceHealth } from '../hooks/use-service-health';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export function ServiceStatus() {
  const health = useServiceHealth();
  if (health.isPending) return <LoadingState label="جارٍ التحقق من الاتصال..." />;
  if (health.isError) return <ErrorState message="تعذّر الاتصال بالخدمة." onRetry={() => { void health.refetch(); }} />;
  const ready = health.data.ready.database === 'available';
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }} aria-label="حالة الاتصال">
      {ready ? <CheckCircleOutlined color="success" /> : <InfoOutlined color="warning" />}
      <Box sx={{ flex: 1, minWidth: 170 }} role="status">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{ready ? 'الخدمة متاحة' : 'الخدمة متاحة جزئياً'}</Typography>
        <Typography variant="body2" color="text.secondary">{ready ? 'الاتصال جاهز لتحميل البيانات.' : 'تعذّر الوصول إلى البيانات حالياً.'}</Typography>
      </Box>
      <Chip size="small" variant="outlined" color={ready ? 'success' : 'warning'} label={ready ? 'متصل' : 'اتصال محدود'} />
      <Button size="small" disabled={health.isFetching} onClick={() => { void health.refetch(); }}>تحديث</Button>
    </Paper>
  );
}
