import { Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function ProfilePage() {
  const { t } = useTranslation();

  return <Title order={1}>{t('pages.profile.title')}</Title>;
}
