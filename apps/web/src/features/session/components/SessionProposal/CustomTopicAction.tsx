import { Button } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomTopicForm } from '@/features/session/components/CustomTopicForm/CustomTopicForm';

interface CustomTopicActionProps {
  disabled: boolean;
  onApply: (topic: string) => void;
}

export function CustomTopicAction({
  disabled,
  onApply,
}: CustomTopicActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      openerRef.current?.focus();
    }
  }, [open]);

  function cancel() {
    restoreFocus.current = true;
    setOpen(false);
  }

  if (open) {
    return (
      <CustomTopicForm
        onSubmit={(topic) => {
          onApply(topic);
          setOpen(false);
        }}
        onCancel={cancel}
      />
    );
  }

  return (
    <Button
      ref={openerRef}
      variant="default"
      size="lg"
      disabled={disabled}
      onClick={() => setOpen(true)}
    >
      {t('session.proposal.custom.open')}
    </Button>
  );
}
