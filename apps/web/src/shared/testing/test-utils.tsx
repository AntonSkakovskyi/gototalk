import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Me } from '@gototalk/shared';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { clearSession, setSession } from '@/shared/session/session-store';
import i18n from '@/shared/i18n/index';
import { theme } from '@/app/theme/theme';

interface RenderOptions {
  queryClient?: QueryClient;
  route?: string;
  session?: { user: Me; accessToken: string } | 'anonymous';
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', session, queryClient: providedClient }: RenderOptions = {},
): RenderResult {
  if (session === 'anonymous') {
    clearSession();
  } else if (session) {
    setSession(session);
  }

  const queryClient =
    providedClient ??
    new QueryClient({
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
