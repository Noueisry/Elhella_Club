import { Alert, Button } from '@mui/material';

export function ErrorState({
  message = 'تعذّر تحميل البيانات. يرجى المحاولة مجدداً.',
  onRetry,
}: { message?: string; onRetry?: () => void }) {
  return (
    <Alert severity="error" role="alert" action={onRetry && <Button color="inherit" onClick={onRetry}>إعادة المحاولة</Button>}>
      {message}
    </Alert>
  );
}
