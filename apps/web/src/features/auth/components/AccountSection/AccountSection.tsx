import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classes from './AccountSection.module.scss';
import { DeleteAccountDialog } from '@/features/auth/components/DeleteAccountDialog/DeleteAccountDialog';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { useSession } from '@/shared/auth-session/session-store';

export function AccountSection() {
  const { t } = useTranslation();
  const { user } = useSession();
  const titleId = useId();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const signOut = useLogout();

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
      {signOut.isError && (
        <Alert color="red">{t('auth.errors.logoutFailed')}</Alert>
      )}
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
