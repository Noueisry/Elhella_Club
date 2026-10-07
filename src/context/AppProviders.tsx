import type { PropsWithChildren } from 'react';
import { CacheProvider } from '@emotion/react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rtlCache, theme } from './theme';
import { AuthProvider } from './AuthProvider';
import { NotificationProvider } from './NotificationProvider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}><AuthProvider><NotificationProvider>{children}</NotificationProvider></AuthProvider></QueryClientProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
