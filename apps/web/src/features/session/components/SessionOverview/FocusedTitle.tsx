import { Title } from '@mantine/core';
import { useEffect, useRef, type ReactNode } from 'react';

interface FocusedTitleProps {
  lang?: string;
  children: ReactNode;
}

export function FocusedTitle({ lang, children }: FocusedTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => ref.current?.focus(), []);

  return (
    <Title order={1} lang={lang} tabIndex={-1} ref={ref}>
      {children}
    </Title>
  );
}
