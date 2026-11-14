import { Button, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HintOutcome } from '@/features/dialogue/components/HintPanel/HintOutcome';
import { WordHintForm } from '@/features/dialogue/components/HintPanel/WordHintForm';
import { useHint } from '@/features/dialogue/hooks/use-hint';

interface HintPanelProps {
  sessionId: string;
}

export function HintPanel({ sessionId }: HintPanelProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const [opened, { toggle }] = useDisclosure(false);
  const [wordFormOpened, setWordFormOpened] = useState(false);
  const hint = useHint(sessionId);

  const showPhraseStart = () => {
    setWordFormOpened(false);
    hint.phraseStart();
  };
  const toggleWordForm = () => {
    hint.reset();
    setWordFormOpened((current) => !current);
  };

  return (
    <Stack gap="sm">
      <Button
        variant="light"
        size="lg"
        aria-expanded={opened}
        aria-controls={opened ? panelId : undefined}
        onClick={toggle}
      >
        {t('dialogue.hint.open')}
      </Button>
      {opened && (
        <Stack id={panelId} gap="sm">
          <Button
            variant="default"
            size="lg"
            disabled={hint.isPending}
            onClick={showPhraseStart}
          >
            {t('dialogue.hint.phraseStart')}
          </Button>
          <Button
            variant="default"
            size="lg"
            aria-expanded={wordFormOpened}
            disabled={hint.isPending}
            onClick={toggleWordForm}
          >
            {t('dialogue.hint.translateWord')}
          </Button>
          {wordFormOpened && (
            <WordHintForm disabled={hint.isPending} onSubmit={hint.translate} />
          )}
          <HintOutcome
            request={hint.request}
            result={hint.data}
            error={hint.error}
            isPending={hint.isPending}
            onRetry={hint.retry}
          />
        </Stack>
      )}
    </Stack>
  );
}
