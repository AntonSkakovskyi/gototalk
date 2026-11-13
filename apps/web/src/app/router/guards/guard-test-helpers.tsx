import { screen } from '@testing-library/react';
import { App } from '@/app/App';
import { LocationProbe } from '@/shared/testing/LocationProbe';
import {
  renderWithProviders,
  type RenderOptions,
} from '@/shared/testing/test-utils';

export function renderAppWithProbe(
  options: Pick<RenderOptions, 'route' | 'session' | 'queryClient'>,
) {
  return renderWithProviders(
    <>
      <App />
      <LocationProbe />
    </>,
    options,
  );
}

export function heading(name: string) {
  return screen.findByRole('heading', { level: 1, name });
}

export function currentLocation() {
  return screen.getByTestId('location-path').textContent;
}
