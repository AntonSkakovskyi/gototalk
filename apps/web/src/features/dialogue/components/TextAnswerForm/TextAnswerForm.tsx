import { ANSWER_TEXT_MAX } from '@gototalk/shared';
import { Button, Stack, Textarea, type InputWrapperProps } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useAnswerForm } from '@/features/dialogue/hooks/use-answer-form';
import type { AnswerPhase } from '@/features/dialogue/hooks/use-answer-flow';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';

const ANSWER_LANGUAGE = 'en';
const WRAPPER_ORDER: InputWrapperProps['inputWrapperOrder'] = [
  'label',
  'input',
  'description',
  'error',
];
const MIN_ROWS = 3;
const MAX_ROWS = 8;

interface TextAnswerFormProps {
  phase: AnswerPhase;
  submit: (text: string) => Promise<boolean>;
}

export function TextAnswerForm({ phase, submit }: TextAnswerFormProps) {
  const { t } = useTranslation();
  const form = useAnswerForm(submit);
  const { message } = form;

  return (
    <form noValidate onSubmit={form.onSubmit}>
      <Stack gap="sm">
        <Textarea
          size="lg"
          label={t('dialogue.form.label')}
          description={t('dialogue.form.counter', {
            length: form.length,
            max: ANSWER_TEXT_MAX,
          })}
          inputWrapperOrder={WRAPPER_ORDER}
          error={message && t(message.key, message.values ?? {})}
          errorProps={ANNOUNCED_ERROR_PROPS}
          lang={ANSWER_LANGUAGE}
          autosize
          minRows={MIN_ROWS}
          maxRows={MAX_ROWS}
          {...form.field}
        />
        <Button
          type="submit"
          size="lg"
          disabled={phase !== 'idle' || form.isSubmitting}
        >
          {t('dialogue.form.submit')}
        </Button>
      </Stack>
    </form>
  );
}
