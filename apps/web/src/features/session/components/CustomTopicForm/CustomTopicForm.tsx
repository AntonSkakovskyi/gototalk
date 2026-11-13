import { TOPIC_MAX } from '@gototalk/shared';
import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useCustomTopicForm } from '@/features/session/hooks/use-custom-topic-form';
import { ANNOUNCED_ERROR_PROPS } from '@/shared/forms/field-error-props';

interface CustomTopicFormProps {
  onSubmit: (topic: string) => void;
  onCancel: () => void;
}

export function CustomTopicForm({ onSubmit, onCancel }: CustomTopicFormProps) {
  const { t } = useTranslation();
  const form = useCustomTopicForm(onSubmit);
  const { message } = form;

  return (
    <form noValidate onSubmit={form.onSubmit}>
      <Stack gap="md">
        <TextInput
          size="lg"
          label={t('session.proposal.custom.label')}
          maxLength={TOPIC_MAX}
          error={message && t(message.key, message.values)}
          errorProps={ANNOUNCED_ERROR_PROPS}
          {...form.field}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" size="lg" onClick={onCancel}>
            {t('session.proposal.custom.cancel')}
          </Button>
          <Button type="submit" size="lg">
            {t('session.proposal.custom.submit')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
