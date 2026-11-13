import { Skeleton, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';

const ROW_HEIGHT = '3rem';

export function SectionSkeleton() {
  const { t } = useTranslation();

  return (
    <Stack gap="sm" role="status" aria-label={t('profile.loading')}>
      <Skeleton height={ROW_HEIGHT} />
      <Skeleton height={ROW_HEIGHT} />
    </Stack>
  );
}
