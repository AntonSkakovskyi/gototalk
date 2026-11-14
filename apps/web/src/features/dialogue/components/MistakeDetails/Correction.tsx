import { Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import classes from './Correction.module.scss';

const CORRECTION_LANGUAGE = 'en';

interface CorrectionProps {
  original: string;
  suggestion: string;
}

export function Correction({ original, suggestion }: CorrectionProps) {
  const { t } = useTranslation();

  return (
    <Stack gap={0}>
      <Text size="sm" c="dimmed">
        {t('dialogue.mistake.fixLabel')}
      </Text>
      <Text lang={CORRECTION_LANGUAGE}>
        <del className={classes.removed}>{original}</del>
        {suggestion !== '' && (
          <>
            {' → '}
            <ins className={classes.added}>{suggestion}</ins>
          </>
        )}
      </Text>
    </Stack>
  );
}
