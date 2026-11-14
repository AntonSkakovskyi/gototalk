import { HintTranslationRequestSchema } from '@gototalk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { hintWordErrorMessage } from '@/features/dialogue/lib/hint-form';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';
import { UKRAINIAN_LANG } from '@/shared/i18n/languages';

const WordSchema = HintTranslationRequestSchema.pick({ word: true });

interface WordHintFormProps {
  disabled: boolean;
  onSubmit: (word: string) => void;
}

export function WordHintForm({ disabled, onSubmit }: WordHintFormProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(WordSchema),
    defaultValues: { word: '' },
  });
  const wordField = register('word');
  const message = hintWordErrorMessage(formState.errors.word);

  return (
    <form
      noValidate
      onSubmit={(event) =>
        void handleSubmit(({ word }) => onSubmit(word))(event)
      }
    >
      <Stack gap="sm">
        <TextInput
          size="lg"
          label={t('dialogue.hint.word.label')}
          error={message && t(message.key, message.values ?? {})}
          errorProps={ANNOUNCED_ERROR_PROPS}
          lang={UKRAINIAN_LANG}
          autoComplete="off"
          autoFocus
          {...wordField}
        />
        <Button type="submit" size="lg" disabled={disabled}>
          {t('dialogue.hint.word.submit')}
        </Button>
      </Stack>
    </form>
  );
}
