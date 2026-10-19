// Окно решения с обязательной причиной: отказ организации, снятие, удаление, скрытие сообщения.
import { zodFieldErrors } from '@sport/shared';
import { MODERATION_REASON, moderationReasonBody } from '@sport/shared/schemas/admin';
import { useEffect, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { Alert, Button, Modal, TextareaField } from '../../shared/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Кому будет видна причина: «Её увидят организатор и записавшиеся». */
  hint: string;
  confirmLabel: string;
  pending: boolean;
  /** Ошибка последней попытки: 422 по полю reason — под полем, остальное — над формой. */
  error: unknown;
  onSubmit: (reason: string) => void;
};

export function ReasonModal(props: Props) {
  const { open, onClose, title, hint, confirmLabel, pending, error, onSubmit } = props;
  const [reason, setReason] = useState('');
  const [fieldError, setFieldError] = useState<string>();

  // Каждое открытие — с чистого листа.
  useEffect(() => {
    if (open) {
      setReason('');
      setFieldError(undefined);
    }
  }, [open]);

  const submit = () => {
    const parsed = moderationReasonBody.safeParse({ reason });
    if (!parsed.success) return setFieldError(zodFieldErrors(parsed.error).reason);
    setFieldError(undefined);
    onSubmit(parsed.data.reason);
  };

  const serverField = error instanceof ApiError ? error.fields.reason : undefined;
  let serverMessage: string | null = null;
  if (error && !serverField) {
    serverMessage = error instanceof ApiError ? error.message : 'Не удалось сохранить решение';
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" loading={pending} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {serverMessage && <Alert>{serverMessage}</Alert>}
        <TextareaField
          label="Причина"
          hint={`${hint}. От ${MODERATION_REASON.min} до ${MODERATION_REASON.max} символов`}
          value={reason}
          maxLength={MODERATION_REASON.max}
          onChange={(e) => setReason(e.target.value)}
          error={fieldError ?? serverField}
        />
      </div>
    </Modal>
  );
}
