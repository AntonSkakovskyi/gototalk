import { isScenePreset, type Profile } from '@gototalk/shared';
import { Button, List, Stack, Text } from '@mantine/core';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

interface ProfileViewProps {
  profile: Profile;
  onEdit: () => void;
  editButtonRef: Ref<HTMLButtonElement>;
}

export function ProfileView({
  profile,
  onEdit,
  editButtonRef,
}: ProfileViewProps) {
  const { t } = useTranslation();

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {t('profile.details.level')}
        </Text>
        <Text fw={700}>{t(`profile.levels.${profile.level}.title`)}</Text>
        <Text size="sm" c="dimmed">
          {t(`profile.levels.${profile.level}.description`)}
        </Text>
      </Stack>
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {t('profile.details.scenes')}
        </Text>
        <List spacing="xs">
          {profile.scenes.map((scene) => (
            <List.Item key={scene}>
              {isScenePreset(scene)
                ? t(`profile.scenes.presets.${scene}`)
                : scene}
            </List.Item>
          ))}
        </List>
      </Stack>
      <Button
        ref={editButtonRef}
        variant="light"
        size="lg"
        aria-label={t('profile.details.editLabel')}
        onClick={onEdit}
      >
        {t('profile.actions.edit')}
      </Button>
    </Stack>
  );
}
