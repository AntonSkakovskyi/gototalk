import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import {
  customTopicSchema,
  topicErrorMessage,
  type CustomTopicValues,
} from '@/features/session/lib/custom-topic-form';

export function useCustomTopicForm(onTopic: (topic: string) => void) {
  const form = useForm<CustomTopicValues>({
    resolver: zodResolver(customTopicSchema),
    defaultValues: { topic: '' },
  });
  const { setFocus } = form;

  useEffect(() => setFocus('topic'), [setFocus]);

  return {
    field: form.register('topic'),
    message: topicErrorMessage(form.formState.errors.topic),
    onSubmit: (event: FormEvent<HTMLFormElement>) =>
      void form.handleSubmit(({ topic }) => onTopic(topic))(event),
  };
}
