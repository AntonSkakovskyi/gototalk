import {
  AnswerTextRequestSchema,
  type AnswerTextRequest,
} from '@gototalk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { answerErrorMessage } from '@/features/dialogue/lib/answer-form';

export function useAnswerForm(submit: (text: string) => Promise<boolean>) {
  const form = useForm<AnswerTextRequest>({
    resolver: zodResolver(AnswerTextRequestSchema),
    defaultValues: { text: '' },
  });
  const { reset, setFocus } = form;

  return {
    field: form.register('text'),
    length: form.watch('text').length,
    isSubmitting: form.formState.isSubmitting,
    message: answerErrorMessage(form.formState.errors.text),
    onSubmit: (event: FormEvent<HTMLFormElement>) =>
      void form.handleSubmit(async ({ text }) => {
        if (await submit(text)) {
          reset();
        } else {
          setFocus('text');
        }
      })(event),
  };
}
