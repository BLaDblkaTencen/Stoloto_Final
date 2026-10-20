// Окно «Кто пришёл на встречу?» для организатора прошедшей встречи (человека или клуба).
// Главное — «На встрече» или «Не было»: из этого складывается надёжность участника. Звёзды, теги
// и комментарий — по желанию и только тем, кто пришёл.
import type { MyEventItem } from '@sport/shared/schemas/events';
import {
  PARTICIPANT_TAGS,
  REVIEW_COMMENT_MAX,
  REVIEW_TAG_LABELS,
  type AttendanceItem,
  type ParticipantTag,
} from '@sport/shared/schemas/reviews';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  Alert,
  Avatar,
  Button,
  Chip,
  ErrorState,
  Modal,
  SkeletonList,
  TextareaField,
} from '../../../shared/ui';
import { formErrors } from '../../org/errors';
import { useAttendance, useSaveAttendance } from '../api';
import { StarsInput } from './Stars';
import { REVIEW_TAG_ICONS } from './tags';

type Mark = Pick<AttendanceItem, 'attended' | 'rating' | 'tags' | 'comment'> & {
  showComment: boolean;
};

export function AttendanceModal({
  event,
  open,
  onClose,
}: {
  event: MyEventItem;
  open: boolean;
  onClose: () => void;
}) {
  const attendance = useAttendance(event.id, open);
  return (
    <Modal open={open} onClose={onClose} title="Кто пришёл на встречу?">
      {!open ? null : attendance.isPending ? (
        <SkeletonList count={2} />
      ) : attendance.isError ? (
        <ErrorState error={attendance.error} onRetry={() => attendance.refetch()} />
      ) : (
        <AttendanceForm
          eventId={event.id}
          title={event.title}
          items={attendance.data.items}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function AttendanceForm({
  eventId,
  title,
  items,
  onDone,
}: {
  eventId: string;
  title: string;
  items: AttendanceItem[];
  onDone: () => void;
}) {
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.user.id,
        {
          attended: item.attended,
          rating: item.rating,
          tags: item.tags,
          comment: item.comment,
          showComment: Boolean(item.comment),
        },
      ]),
    ),
  );
  const save = useSaveAttendance(eventId);
  const server = formErrors(save.error, 'Не получилось сохранить отметки. Попробуйте ещё раз');

  const update = (userId: string, patch: Partial<Mark>) =>
    setMarks((current) => ({ ...current, [userId]: { ...current[userId]!, ...patch } }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        marks: items.map(({ user }) => {
          const { showComment: _shown, ...mark } = marks[user.id]!;
          return { userId: user.id, ...mark };
        }),
      },
      { onSuccess: onDone },
    );
  };

  if (items.length === 0) {
    return <p>На «{title}» никто не записался — отмечать некого.</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-ink-muted">
        {title}. Пока вы никого не отметили, все считаются пришедшими. Участник увидит вашу оценку,
        когда сам оценит встречу.
      </p>
      {server.message && <Alert>{server.message}</Alert>}

      <ul className="flex flex-col">
        {items.map(({ user }) => {
          const mark = marks[user.id]!;
          return (
            <li
              key={user.id}
              className="flex flex-col gap-3 border-t-2 border-dashed border-line-soft py-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <Avatar name={user.name} size={40} />
                  <Link to={`/users/${user.id}`} className="font-semibold">
                    {user.name}
                  </Link>
                </span>
                <div
                  role="group"
                  aria-label={`Явка: ${user.name}`}
                  className="inline-flex overflow-hidden rounded-md border-2 border-ink"
                >
                  <SegmentButton
                    pressed={mark.attended}
                    tone="bg-status-success"
                    onClick={() => update(user.id, { attended: true })}
                  >
                    На встрече
                  </SegmentButton>
                  <SegmentButton
                    pressed={!mark.attended}
                    tone="bg-status-danger"
                    onClick={() => update(user.id, { attended: false })}
                  >
                    Не было
                  </SegmentButton>
                </div>
              </div>

              {mark.attended ? (
                <>
                  <StarsInput
                    label={`Оценка участника ${user.name}, необязательно`}
                    value={mark.rating ?? 0}
                    onChange={(rating) => update(user.id, { rating })}
                    size={28}
                  />
                  <div className="flex flex-wrap gap-2">
                    {PARTICIPANT_TAGS.map((tag, index) => (
                      <Chip
                        key={tag}
                        index={index}
                        icon={REVIEW_TAG_ICONS[tag]}
                        pressed={mark.tags.includes(tag)}
                        color="var(--status-success)"
                        onClick={() => update(user.id, { tags: toggle(mark.tags, tag) })}
                      >
                        {REVIEW_TAG_LABELS[tag]}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-muted">Неявка войдёт в надёжность участника.</p>
              )}

              {mark.showComment ? (
                <TextareaField
                  label={`Комментарий — ${user.name}`}
                  hint="Необязательно. Увидят в профиле участника"
                  rows={2}
                  maxLength={REVIEW_COMMENT_MAX}
                  value={mark.comment ?? ''}
                  onChange={(e) => update(user.id, { comment: e.target.value })}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => update(user.id, { showComment: true })}
                  className="min-h-[var(--control-height)] cursor-pointer self-start font-semibold underline decoration-accent decoration-[3px] underline-offset-4"
                >
                  + Добавить комментарий
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" loading={save.isPending}>
          Сохранить отметки
        </Button>
      </div>
    </form>
  );
}

const toggle = (tags: ParticipantTag[], tag: ParticipantTag) =>
  tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];

function SegmentButton({
  pressed,
  tone,
  onClick,
  children,
}: {
  pressed: boolean;
  tone: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`min-h-[var(--control-height)] cursor-pointer px-4 text-sm font-semibold not-first:border-l-2 not-first:border-ink ${pressed ? tone : 'bg-surface hover:bg-surface-muted'}`}
    >
      {children}
    </button>
  );
}
