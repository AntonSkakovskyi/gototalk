import { VisuallyHidden } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export function ReplaceArrow() {
  const { t } = useTranslation();

  return (
    <>
      <span aria-hidden="true"> → </span>
      <VisuallyHidden>{t('transcript.replacedBy')}</VisuallyHidden>
    </>
  );
}
