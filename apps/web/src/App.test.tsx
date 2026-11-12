import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { App } from './App.js';
import { theme } from './theme.js';

describe('App', () => {
  it('[TC-00-04] рендерить кореневий елемент застосунку', () => {
    render(
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
