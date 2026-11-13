import { Fieldset, Input, Stack, Text } from '@mantine/core';
import { useEffect, useRef, type ReactNode } from 'react';
import { useErrorText } from '@/features/profile/hooks/use-error-text';
import type { ProfileErrorMessage } from '@/features/profile/lib/profile-errors';
import classes from './StepFieldset.module.scss';

interface StepFieldsetProps {
  title: string;
  hint: string;
  error?: ProfileErrorMessage | null;
  focusOnMount: boolean;
  children: ReactNode;
}

export function StepFieldset({
  title,
  hint,
  error,
  focusOnMount,
  children,
}: StepFieldsetProps) {
  const errorText = useErrorText();
  const ref = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <Fieldset
      ref={ref}
      tabIndex={-1}
      variant="unstyled"
      legend={title}
      classNames={{ root: classes.root, legend: classes.legend }}
    >
      <Stack gap="md">
        <Text c="dimmed">{hint}</Text>
        {children}
        {error && <Input.Error role="alert">{errorText(error)}</Input.Error>}
      </Stack>
    </Fieldset>
  );
}
