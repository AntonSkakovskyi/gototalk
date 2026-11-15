import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterRequestSchema, type RegisterRequest } from '@gototalk/shared';
import {
  Alert,
  Anchor,
  Button,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { register as registerAccount } from '@/features/auth/api/auth-api';
import {
  apiErrorKey,
  emailErrorKey,
  passwordErrorKey,
} from '@/features/auth/lib/auth-form';
import { AuthLayout } from '@/features/auth/components/AuthLayout/AuthLayout';
import type { TranslationKey } from '@/shared/i18n/translation-key';

export function RegisterPage() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<TranslationKey | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(RegisterRequestSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerAccount(values);
    } catch (error) {
      setSubmitError(apiErrorKey(error));
    }
  });

  const emailField = register('email');
  const passwordField = register('password');
  const emailKey = emailErrorKey(errors.email);
  const passwordKey = passwordErrorKey(
    errors.password,
    'auth.validation.passwordTooShort',
  );

  return (
    <AuthLayout title={t('auth.register.title')}>
      <form onSubmit={onSubmit} noValidate>
        <Stack gap="md">
          {submitError && (
            <Alert color="red" role="alert">
              {t(submitError)}
            </Alert>
          )}
          <TextInput
            type="email"
            label={t('auth.fields.email')}
            autoComplete="email"
            error={emailKey && t(emailKey)}
            {...emailField}
          />
          <PasswordInput
            label={t('auth.fields.password')}
            description={t('auth.register.passwordHint')}
            autoComplete="new-password"
            error={passwordKey && t(passwordKey)}
            aria-invalid={Boolean(passwordKey)}
            {...passwordField}
          />
          <Button type="submit" loading={isSubmitting} fullWidth>
            {t('auth.register.submit')}
          </Button>
        </Stack>
      </form>
      <Text ta="center" size="sm">
        {t('auth.register.haveAccount')}{' '}
        <Anchor component={Link} to="/login">
          {t('auth.register.toLogin')}
        </Anchor>
      </Text>
    </AuthLayout>
  );
}
