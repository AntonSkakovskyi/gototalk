import { Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ReplaceArrow } from '@/entities/session/components/ReplaceArrow/ReplaceArrow';
import { ENGLISH_LANG } from '@/shared/i18n/languages';
import classes from './Correction.module.scss';

interface CorrectionProps {
  original: string;
  suggestion: string;
}

export function Correction({ original, suggestion }: CorrectionProps) {
  const { t } = useTranslation();

  return (
    <Stack gap={0}>
      <Text size="sm" c="dimmed">
        {t('transcript.mistake.fixLabel')}
      </Text>
      <Text lang={ENGLISH_LANG}>
        <del className={classes.removed}>{original}</del>
        {suggestion !== '' && (
          <>
            <ReplaceArrow />
            <ins className={classes.added}>{suggestion}</ins>
          </>
        )}
      </Text>
    </Stack>
  );
}
