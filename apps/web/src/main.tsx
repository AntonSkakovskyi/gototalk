import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthBootstrap } from './auth/AuthBootstrap';
import { clearQueryCacheOnSessionEnd } from './auth/query-cache';
import i18n from './i18n/index';
import { theme } from './theme';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const queryClient = new QueryClient();
clearQueryCacheOnSessionEnd(queryClient);

createRoot(container).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthBootstrap>
              <App />
            </AuthBootstrap>
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </MantineProvider>
  </StrictMode>,
);
