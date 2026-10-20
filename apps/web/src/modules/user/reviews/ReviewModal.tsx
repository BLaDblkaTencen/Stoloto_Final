// Окно «Оцените встречу» из «Мои мероприятия → Прошедшие» (выбранный вариант Б).
// Звёзды обязательны, комментарий и теги — по желанию. Отзыв можно поправить, пока окно открыто.
import type { MyRegistrationItem } from '@sport/shared/schemas/registrations';
import {
  ORGANIZER_TAGS,
  REVIEW_COMMENT_MAX,
  REVIEW_TAG_LABELS,
  REVIEW_WINDOW_DAYS,
  type OrganizerTag,
} from '@sport/shared/schemas/reviews';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Chip, FieldError, Modal, TextareaField } from '../../../shared/ui';
import { formErrors } from '../../org/errors';
import { useSubmitReview } from '../api';
import { StarsInput } from './Stars';

export function ReviewModal({
  event,
  open,
  onClose,
}: {
  event: MyRegistrationItem;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Оцените встречу">
      {/* Форма монтируется заново при каждом открытии: в ней всегда последний сохранённый отзыв. */}
      {open && <ReviewForm event={event} onDone={onClose} />}
    </Modal>
  );
}

function ReviewForm({ event, onDone }: { event: MyRegistrationItem; onDone: () => void }) {
  const mine = event.review?.mine ?? null;
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [tags, setTags] = useState<OrganizerTag[]>(mine?.tags ?? []);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const submit = useSubmitReview(event.id);
  const server = formErrors(submit.error, 'Не получилось отправить отзыв. Попробуйте ещё раз');

  const toggle = (tag: OrganizerTag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (rating === 0) return setRatingError('Поставьте оценку от 1 до 5');
    submit.mutate({ rating, tags, comment }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-ink-muted">
        {event.title} · {event.organizer.name}
      </p>
      {server.message && <Alert>{server.message}</Alert>}

      <div className="flex flex-col gap-1">
        <span className="font-semibold">Как прошла встреча?</span>
        <StarsInput
          label="Оценка встречи"
          value={rating}
          onChange={(value) => {
            setRating(value);
            setRatingError(null);
          }}
        />
        {(ratingError ?? server.fields.rating) && (
          <FieldError>{ratingError ?? server.fields.rating}</FieldError>
        )}
      </div>

      <TextareaField
        label="Что понравилось или что улучшить?"
        hint="Необязательно. Отзыв увидят на странице организатора"
        placeholder="Например: удобное место, начали вовремя"
        rows={3}
        maxLength={REVIEW_COMMENT_MAX}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        error={server.fields.comment}
      />

      <div role="group" aria-label="Что можно отметить" className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-ink-muted">Можно отметить:</span>
        <div className="flex flex-wrap gap-2">
          {ORGANIZER_TAGS.map((tag, index) => (
            <Chip
              key={tag}
              index={index}
              pressed={tags.includes(tag)}
              color="var(--status-success)"
              onClick={() => toggle(tag)}
            >
              {REVIEW_TAG_LABELS[tag]}
            </Chip>
          ))}
        </div>
      </div>

      <p className="rounded-md bg-surface-muted p-3 text-sm">
        Отзыв откроется, когда организатор отметит участников, или через {REVIEW_WINDOW_DAYS} дней
        после встречи. До этого его можно поправить.
      </p>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" loading={submit.isPending}>
          {mine ? 'Сохранить отзыв' : 'Отправить отзыв'}
        </Button>
      </div>
    </form>
  );
}
