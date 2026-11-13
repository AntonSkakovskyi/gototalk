import { Button, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logout } from '@/features/auth/api/auth-api';
import classes from './AccountSection.module.scss';
import { DeleteAccountDialog } from '@/features/auth/components/DeleteAccountDialog/DeleteAccountDialog';
import { useSession } from '@/shared/session/session-store';

export function AccountSection() {
  const { t } = useTranslation();
  const { user } = useSession();
  const titleId = useId();
  const [deleteOpened, setDeleteOpened] = useState(false);
  // logout() clears the session even when the request fails, so its error needs no handling.
  const signOut = useMutation({ mutationFn: logout });

  return (
    <Stack gap="md" component="section" aria-labelledby={titleId}>
      <Title order={2} size="h3" id={titleId}>
        {t('pages.profile.account.title')}
      </Title>
      <Stack gap={2}>
        <Text size="sm" c="dimmed">
          {t('auth.fields.email')}
        </Text>
        <Text className={classes.email}>{user?.email}</Text>
      </Stack>
      <div className={classes.actions}>
        <Button
          variant="default"
          loading={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {t('pages.profile.account.logout')}
        </Button>
        <Button
          variant="light"
          color="red"
          onClick={() => setDeleteOpened(true)}
        >
          {t('pages.profile.account.delete.open')}
        </Button>
      </div>
      <DeleteAccountDialog
        opened={deleteOpened}
        onClose={() => setDeleteOpened(false)}
      />
    </Stack>
  );
}
