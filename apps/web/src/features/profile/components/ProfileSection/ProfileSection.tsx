import { Stack, Title } from '@mantine/core';
import { useId, type ReactNode, type Ref } from 'react';

interface ProfileSectionProps {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}

export function ProfileSection({
  title,
  titleRef,
  children,
}: ProfileSectionProps) {
  const titleId = useId();

  return (
    <Stack gap="md" component="section" aria-labelledby={titleId}>
      <Title ref={titleRef} order={2} size="h3" id={titleId} tabIndex={-1}>
        {title}
      </Title>
      {children}
    </Stack>
  );
}
