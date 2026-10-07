import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/500.css';
import '@fontsource/noto-sans-arabic/600.css';
import '@fontsource/noto-sans-arabic/700.css';
import './index.css';
import { AppProviders } from './context/AppProviders';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { router } from './routers/router';

const root = document.getElementById('root');
if (!root) throw new Error('تعذّر بدء التطبيق.');

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppErrorBoundary><RouterProvider router={router} /></AppErrorBoundary>
    </AppProviders>
  </StrictMode>,
);
