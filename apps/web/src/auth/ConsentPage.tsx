import { Alert, Button, List, Loader, Stack, Text } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConsentInfo, grantConsent, logout } from './auth-api';
import { AuthLayout } from './AuthLayout';
import classes from './ConsentPage.module.scss';

export function ConsentPage() {
  const { t } = useTranslation();
  const info = useQuery({
    queryKey: ['me', 'consent'],
    queryFn: getConsentInfo,
  });
  const consent = useMutation({ mutationFn: grantConsent });
  const signOut = useMutation({ mutationFn: logout });

  return (
    <AuthLayout title={t('pages.consent.title')}>
      <Stack gap="md" className={classes.content}>
        <Text>{t('pages.consent.intro')}</Text>
        {info.isPending && (
          <div
            className={classes.loader}
            role="status"
            aria-label={t('auth.loading')}
          >
            <Loader size="sm" />
          </div>
        )}
        {info.isError && (
          <Alert color="red">
            <Stack gap="xs" className={classes.retry}>
              {t('auth.errors.generic')}
              <Button
                variant="light"
                color="red"
                size="xs"
                loading={info.isFetching}
                onClick={() => void info.refetch()}
              >
                {t('pages.consent.retry')}
              </Button>
            </Stack>
          </Alert>
        )}
        {info.data && (
          <List className={classes.list}>
            <List.Item>
              {t('pages.consent.stt', {
                provider: t(
                  `pages.consent.providers.${info.data.providers.stt}`,
                ),
              })}
            </List.Item>
            <List.Item>
              {t('pages.consent.llm', {
                provider: t(
                  `pages.consent.providers.${info.data.providers.llm}`,
                ),
              })}
            </List.Item>
          </List>
        )}
        <Text>{t('pages.consent.transfer')}</Text>
        <Text>{t('pages.consent.audioNotStored')}</Text>
        <Text>{t('pages.consent.deletion')}</Text>
        {consent.isError && (
          <Alert color="red">{t('auth.errors.generic')}</Alert>
        )}
        <Stack gap="xs">
          <Button
            fullWidth
            disabled={!info.data}
            loading={consent.isPending}
            onClick={() => consent.mutate()}
          >
            {t('pages.consent.agree')}
          </Button>
          <Button
            fullWidth
            variant="default"
            loading={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            {t('pages.consent.logout')}
          </Button>
        </Stack>
      </Stack>
    </AuthLayout>
  );
}
