import { screen } from '@testing-library/react';
import { uk } from '@/shared/i18n/resources';
import { renderWithProviders } from '@/shared/testing/test-utils';
import { SectionSkeleton } from '@/shared/ui/SectionSkeleton/SectionSkeleton';

describe('SectionSkeleton', () => {
  it('[TC-03-03] exposes a status region with an accessible loading name', () => {
    renderWithProviders(<SectionSkeleton />);

    expect(
      screen.getByRole('status', { name: uk.common.loading }),
    ).toBeInTheDocument();
  });
});
