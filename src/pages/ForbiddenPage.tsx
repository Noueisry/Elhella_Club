import { Alert, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { homeFor } from '../models/auth';

export function ForbiddenPage() {
  const { user } = useAuth();
  return <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
    <Typography component="h1" variant="h5">الوصول غير مسموح</Typography>
    <Alert severity="warning">ليس لديك صلاحية للوصول إلى هذه الصفحة.</Alert>
    <Button component={Link} to={user ? homeFor(user) : '/login'} variant="contained">العودة إلى المساحة المسموح بها</Button>
  </Stack>;
}
