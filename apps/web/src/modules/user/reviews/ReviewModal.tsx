// Окно «Оцените встречу» из «Мои мероприятия → Прошедшие», вариант В: по шагам внутри окна.
// На экране один вопрос — звёзды, затем теги, затем комментарий, — поэтому окно короткое и не
// прокручивается даже на телефоне. Звёзды обязательны, остальное можно пропустить. Тот же вид
// и при правке уже оставленного отзыва, пока окно отзывов открыто.
import type { MyRegistrationItem } from '@sport/shared/schemas/registrations';
import {
  ORGANIZER_TAGS,
  REVIEW_COMMENT_MAX,
  REVIEW_TAG_LABELS,
  REVIEW_WINDOW_DAYS,
  type OrganizerTag,
} from '@sport/shared/schemas/reviews';
import { useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import {
  Alert,
  Button,
  Chip,
  controlClass,
  FieldError,
  Icon,
  Modal,
  sportColor,
} from '../../../shared/ui';
import { formErrors } from '../../org/errors';
import { useSubmitReview } from '../api';
import { StarsInput } from './Stars';
import { REVIEW_TAG_ICONS } from './tags';

const STEPS = 3;

/** Слово под звёздами и его цвет: от красного «не понравилось» к зелёному «отлично». */
const RATING_WORDS = [
  'Оцените звёздами',
  'Не понравилось',
  'Так себе',
  'Нормально',
  'Хорошо',
  'Отлично!',
];
const RATING_COLORS = [
  'var(--color-surface)',
  'var(--status-danger)',
  'var(--sport-8)',
  'var(--status-neutral)',
  'var(--status-free)',
  'var(--status-success)',
];

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
    <Modal
      open={open}
      onClose={onClose}
      title={event.review?.mine ? 'Изменить отзыв' : 'Оцените встречу'}
    >
      {/* Монтируется заново при каждом открытии: шаг первый, в полях последний сохранённый отзыв. */}
      {open && <ReviewSteps event={event} onDone={onClose} />}
    </Modal>
  );
}

function ReviewSteps({ event, onDone }: { event: MyRegistrationItem; onDone: () => void }) {
  const mine = event.review?.mine ?? null;
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [tags, setTags] = useState<OrganizerTag[]>(mine?.tags ?? []);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [ratingError, setRatingError] = useState<string | null>(null);
  const submit = useSubmitReview(event.id);
  const server = formErrors(submit.error, 'Не получилось отправить отзыв. Попробуйте ещё раз');
  const heading = useRef<HTMLHeadingElement>(null);
  // Время смены шага: двойной щелчок по «Дальше» на втором шаге иначе попал бы в «Отправить».
  const steppedAt = useRef(0);
  const ids = { comment: useId(), hint: useId() };

  const goTo = (next: number) => {
    setStep(next);
    steppedAt.current = Date.now();
    // Фокус на новый вопрос: экранный диктор прочитает, что открылся следующий шаг.
    requestAnimationFrame(() => heading.current?.focus());
  };
  const next = () => {
    if (step === 1 && rating === 0) return setRatingError('Поставьте оценку от 1 до 5');
    goTo(step + 1);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS) return next();
    if (Date.now() - steppedAt.current < 400) return;
    submit.mutate({ rating, tags, comment }, { onSuccess: onDone });
  };
  const toggle = (tag: OrganizerTag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  const serverText = server.message ?? server.fields.rating ?? null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: STEPS }, (_, index) => (
            <span
              key={index}
              className="h-3 rounded-full border-2 border-ink transition-[background-color] duration-150"
              style={{
                background: index < step ? sportColor(event.sport.slug) : 'var(--color-surface)',
              }}
            />
          ))}
        </div>
        <p className="text-sm text-ink-muted">
          Шаг {step} из {STEPS} · {event.title}
        </p>
      </div>

      {serverText && <Alert>{serverText}</Alert>}

      {step === 1 && (
        <div className="flex flex-col items-center gap-3 text-center">
          {mine && <Stamp>Вы поставили {mine.rating} — можно изменить</Stamp>}
          <Question headingRef={heading}>Как прошла встреча?</Question>
          <p className="text-sm text-ink-muted">Организатор — {event.organizer.name}</p>
          <StarsInput
            label="Оценка встречи"
            value={rating}
            size={48}
            className="justify-center"
            onChange={(value) => {
              setRating(value);
              setRatingError(null);
            }}
          />
          <RatingWord rating={rating} />
          {ratingError && <FieldError>{ratingError}</FieldError>}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <Question headingRef={heading}>Что было хорошо?</Question>
          <p className="text-sm text-ink-muted">Можно выбрать несколько или пропустить.</p>
          <div role="group" aria-label="Что было хорошо" className="flex flex-wrap gap-2.5">
            {ORGANIZER_TAGS.map((tag, index) => (
              <Chip
                key={tag}
                index={index}
                icon={REVIEW_TAG_ICONS[tag]}
                pressed={tags.includes(tag)}
                color="var(--status-success)"
                onClick={() => toggle(tag)}
              >
                {REVIEW_TAG_LABELS[tag]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <Question headingRef={heading} id={ids.comment}>
            Пара слов для тех, кто пойдёт в следующий раз
          </Question>
          <textarea
            aria-labelledby={ids.comment}
            aria-describedby={ids.hint}
            aria-invalid={server.fields.comment ? true : undefined}
            rows={4}
            maxLength={REVIEW_COMMENT_MAX}
            placeholder="Например: темп спокойный, новичкам подойдёт"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`min-h-28 py-3 leading-normal ${controlClass(server.fields.comment)}`}
          />
          {server.fields.comment && <FieldError>{server.fields.comment}</FieldError>}
          <p id={ids.hint} className="flex gap-2 text-sm text-ink-muted">
            <Icon name="lock" size={18} className="mt-0.5" />
            Необязательно. Отзыв откроется на странице организатора, когда он отметит участников,
            или через {REVIEW_WINDOW_DAYS} дней после встречи.
          </p>
        </div>
      )}

      {/* Кнопки всегда в одну строку: на телефоне главная занимает остаток ширины. */}
      <div className="flex items-center justify-between gap-3">
        {/* На первом шаге «Назад» невидима, но держит место: «Дальше» не прыгает между шагами. */}
        <Button
          type="button"
          variant="secondary"
          onClick={() => goTo(step - 1)}
          className={`shrink-0 ${step === 1 ? 'invisible' : ''}`}
        >
          ← Назад
        </Button>
        {step < STEPS ? (
          <Button type="button" onClick={next} className="min-w-0 flex-1 sm:flex-none">
            Дальше →
          </Button>
        ) : (
          <Button type="submit" loading={submit.isPending} className="min-w-0 flex-1 sm:flex-none">
            {mine ? 'Сохранить' : 'Отправить'}
          </Button>
        )}
      </div>
    </form>
  );
}

function Question({
  headingRef,
  id,
  children,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  id?: string;
  children: ReactNode;
}) {
  return (
    <h3 ref={headingRef} id={id} tabIndex={-1} className="text-[22px] leading-tight outline-none">
      {children}
    </h3>
  );
}

/** Слово-стикер под звёздами: пока оценки нет — пунктирная подсказка. */
function RatingWord({ rating }: { rating: number }) {
  return (
    <span
      aria-live="polite"
      style={{ background: RATING_COLORS[rating] }}
      className={`inline-flex min-h-9 items-center rounded-full border-2 border-ink px-4 font-bold ${
        rating ? '-rotate-2 shadow-sm' : 'border-dashed font-medium text-ink-muted'
      }`}
    >
      {RATING_WORDS[rating]}
    </span>
  );
}

/** Штамп при правке: уже оставленная оценка. */
function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex -rotate-1 items-center gap-2 rounded-md border-2 border-dashed border-ink bg-surface-muted px-3 py-1 text-sm font-semibold">
      <Icon name="check" size={16} />
      {children}
    </span>
  );
}
