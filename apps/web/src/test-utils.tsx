import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@gototalk/shared';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { clearSession, setSession } from './auth/session-store.js';
import i18n from './i18n/index.js';
import { theme } from './theme.js';

interface RenderOptions {
  route?: string;
  session?: { user: Me; accessToken: string } | 'anonymous';
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', session }: RenderOptions = {},
): RenderResult {
  if (session === 'anonymous') {
    clearSession();
  } else if (session) {
    setSession(session);
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MantineProvider theme={theme}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </MantineProvider>,
  );
}
