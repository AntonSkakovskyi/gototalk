import { zodResolver } from '@hookform/resolvers/zod';
import { LoginRequestSchema, type LoginRequest } from '@gototalk/shared';
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
import {
  apiErrorKey,
  emailErrorKey,
  passwordErrorKey,
} from '@/features/auth/lib/auth-form';
import { login } from '@/features/auth/api/auth-api';
import { AuthLayout } from '@/features/auth/components/AuthLayout/AuthLayout';

export function LoginPage() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({ resolver: zodResolver(LoginRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(apiErrorKey(error));
    }
  });

  const emailField = register('email');
  const passwordField = register('password');
  const emailKey = emailErrorKey(errors.email);
  const passwordKey = passwordErrorKey(
    errors.password,
    'auth.validation.passwordRequired',
  );

  return (
    <AuthLayout title={t('auth.login.title')}>
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
            autoComplete="current-password"
            error={passwordKey && t(passwordKey)}
            aria-invalid={Boolean(passwordKey)}
            {...passwordField}
          />
          <Button type="submit" loading={isSubmitting} fullWidth>
            {t('auth.login.submit')}
          </Button>
        </Stack>
      </form>
      <Text ta="center" size="sm">
        {t('auth.login.noAccount')}{' '}
        <Anchor component={Link} to="/register">
          {t('auth.login.toRegister')}
        </Anchor>
      </Text>
    </AuthLayout>
  );
}
