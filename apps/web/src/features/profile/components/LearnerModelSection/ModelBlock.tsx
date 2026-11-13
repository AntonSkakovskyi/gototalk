import { Stack, Title } from '@mantine/core';
import { useId, type ReactNode } from 'react';

interface ModelBlockProps {
  title: string;
  children: ReactNode;
}

export function ModelBlock({ title, children }: ModelBlockProps) {
  const titleId = useId();

  return (
    <Stack gap="sm" role="group" aria-labelledby={titleId}>
      <Title order={3} size="h5" id={titleId}>
        {title}
      </Title>
      {children}
    </Stack>
  );
}
