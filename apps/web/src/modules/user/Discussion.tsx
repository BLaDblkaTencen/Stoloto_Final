// Обсуждение под мероприятием (задача 1.8, сценарий 5 ТЗ): вопрос от любого вошедшего, ответы
// в ветке, плашка «Организатор» или «Модератор» у автора, заглушка вместо скрытого сообщения.
import { COMMENT_MAX } from '@sport/shared/schemas/comments';
import type { Comment } from '@sport/shared/schemas/comments';
import type { EventDetails } from '@sport/shared/schemas/events';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  SkeletonList,
  TextareaField,
} from '../../shared/ui';
import { useAddComment, useComments } from './api';
import { formatMoment } from './format';

export function Discussion({ event }: { event: EventDetails }) {
  const comments = useComments(event.id);
  const location = useLocation();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const canWrite = event.permissions.canComment;
  const total = comments.data?.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  return (
    <Card className="flex flex-col gap-5" aria-labelledby="discussion-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="discussion-title" className="text-h3">
          Обсуждение{total ? ` (${total})` : ''}
        </h2>
        <span className="text-sm text-ink-muted">Спросите организатора о деталях встречи</span>
      </div>

      {comments.isPending ? (
        <SkeletonList count={2} />
      ) : comments.isError ? (
        <ErrorState error={comments.error} onRetry={() => comments.refetch()} />
      ) : comments.data.length === 0 ? (
        <p className="text-ink-muted">
          Вопросов пока нет. Задайте первый — организатор ответит здесь.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.data.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-3">
              <CommentView comment={comment} />
              {comment.replies.length > 0 && (
                <ul className="ml-5 flex flex-col gap-3 border-l-2 border-line-soft pl-4 sm:ml-12">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentView comment={reply} />
                    </li>
                  ))}
                </ul>
              )}
              {canWrite &&
                (replyTo === comment.id ? (
                  <div className="ml-5 sm:ml-12">
                    <CommentForm
                      eventId={event.id}
                      parentId={comment.id}
                      label={`Ответ для ${comment.author.name}`}
                      submitLabel="Ответить"
                      autoFocus
                      onDone={() => setReplyTo(null)}
                    />
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="ml-5 self-start sm:ml-12"
                    onClick={() => setReplyTo(comment.id)}
                  >
                    Ответить
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <CommentForm eventId={event.id} label="Ваш вопрос" submitLabel="Отправить вопрос" />
      ) : event.status !== 'published' ? (
        <p className="text-ink-muted">Публикация недоступна: писать в обсуждение нельзя.</p>
      ) : (
        <ButtonLink
          variant="secondary"
          className="self-start"
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
        >
          Войти, чтобы задать вопрос
        </ButtonLink>
      )}
    </Card>
  );
}

function CommentView({ comment }: { comment: Comment }) {
  const { author } = comment;
  return (
    <article className="flex gap-3">
      <Avatar name={author.name} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <Link to={`/users/${author.id}`} className="font-semibold">
            {author.name}
          </Link>
          {author.badge && (
            <Badge tone={author.badge === 'organizer' ? 'success' : 'request'} icon={null}>
              {author.badge === 'organizer' && author.badgeLabel !== 'Организатор'
                ? `Организатор · ${author.badgeLabel}`
                : author.badgeLabel}
            </Badge>
          )}
          <time dateTime={comment.createdAt} className="text-sm text-ink-muted">
            {formatMoment(comment.createdAt)}
          </time>
        </p>
        {comment.isHidden ? (
          <p className="italic text-ink-muted">Сообщение скрыто модератором</p>
        ) : (
          <p className="whitespace-pre-line break-words">{comment.text}</p>
        )}
      </div>
    </article>
  );
}

function CommentForm({
  eventId,
  parentId,
  label,
  submitLabel,
  autoFocus,
  onDone,
}: {
  eventId: string;
  parentId?: string;
  label: string;
  submitLabel: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const add = useAddComment(eventId);
  const [text, setText] = useState('');
  const [empty, setEmpty] = useState(false);
  const serverError =
    add.error instanceof ApiError
      ? (add.error.fields.text ?? add.error.fields.parentId ?? add.error.message)
      : add.error && 'Не получилось отправить. Попробуйте ещё раз';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return setEmpty(true);
    setEmpty(false);
    add.mutate(
      { text, parentId },
      {
        onSuccess: () => {
          setText('');
          onDone?.();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextareaField
        label={label}
        rows={3}
        maxLength={COMMENT_MAX}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={empty ? 'Напишите сообщение' : (serverError ?? undefined)}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={add.isPending}>
          {submitLabel}
        </Button>
        {onDone && (
          <Button variant="secondary" onClick={onDone}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
