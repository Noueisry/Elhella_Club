import { useState, type PropsWithChildren } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { NotificationContext } from './notification-context';

export function NotificationProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState('');
  return <NotificationContext.Provider value={setMessage}>{children}
    <Snackbar dir="rtl" open={Boolean(message)} autoHideDuration={6000} onClose={() => setMessage('')}>
      <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>
    </Snackbar>
  </NotificationContext.Provider>;
}
