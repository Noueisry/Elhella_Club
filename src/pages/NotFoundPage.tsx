import { Link } from 'react-router-dom';
import { Button, Card, Typography } from '@mui/material';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <Card>
      <Typography component="h1" variant="h1" sx={{ textAlign: 'center', pt: 4 }}>الصفحة غير موجودة</Typography>
      <EmptyState title="لم نعثر على الصفحة المطلوبة" description="تحقّق من العنوان أو عد إلى لوحة التحكم." action={<Button component={Link} to="/" variant="contained">لوحة التحكم</Button>} />
    </Card>
  );
}
