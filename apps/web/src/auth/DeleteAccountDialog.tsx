import { zodResolver } from '@hookform/resolvers/zod';
import {
  DeleteAccountRequestSchema,
  ERROR_CODES,
  type DeleteAccountRequest,
} from '@gototalk/shared';
import {
  Alert,
  Button,
  Modal,
  PasswordInput,
  Stack,
  Text,
} from '@mantine/core';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/api-error';
import { deleteAccount } from './auth-api';
import { deleteAccountErrorKey, passwordErrorKey } from './auth-form';
import classes from './DeleteAccountDialog.module.scss';

interface DeleteAccountFormProps {
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
}

function DeleteAccountForm({
  onCancel,
  onPendingChange,
}: DeleteAccountFormProps) {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<DeleteAccountRequest>({
    resolver: zodResolver(DeleteAccountRequestSchema),
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitError(null);
    onPendingChange(true);
    try {
      await deleteAccount(password);
    } catch (error) {
      setSubmitError(deleteAccountErrorKey(error));
      if (
        error instanceof ApiError &&
        error.code === ERROR_CODES.INVALID_PASSWORD
      ) {
        resetField('password');
        setFocus('password');
      }
    } finally {
      onPendingChange(false);
    }
  });

  const passwordField = register('password');
  const passwordKey = passwordErrorKey(
    errors.password,
    'auth.validation.passwordRequired',
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap="md">
        <Text className={classes.warning}>
          {t('pages.profile.account.delete.warning')}
        </Text>
        {submitError && (
          <Alert color="red" role="alert">
            {t(submitError)}
          </Alert>
        )}
        <PasswordInput
          label={t('auth.fields.password')}
          autoComplete="current-password"
          data-autofocus
          error={passwordKey && t(passwordKey)}
          aria-invalid={Boolean(passwordKey)}
          {...passwordField}
        />
        <div className={classes.actions}>
          <Button variant="default" disabled={isSubmitting} onClick={onCancel}>
            {t('pages.profile.account.delete.cancel')}
          </Button>
          <Button type="submit" color="red" loading={isSubmitting}>
            {t('pages.profile.account.delete.confirm')}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

interface DeleteAccountDialogProps {
  opened: boolean;
  onClose: () => void;
}

export function DeleteAccountDialog({
  opened,
  onClose,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [wasOpened, setWasOpened] = useState(opened);
  const [openCount, setOpenCount] = useState(0);

  // A new form per opening, so a reopen during the exit animation never shows the old password or error.
  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) {
      setOpenCount(openCount + 1);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={pending ? () => undefined : onClose}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      withCloseButton={!pending}
      title={t('pages.profile.account.delete.title')}
      centered
    >
      <DeleteAccountForm
        key={openCount}
        onCancel={onClose}
        onPendingChange={setPending}
      />
    </Modal>
  );
}
