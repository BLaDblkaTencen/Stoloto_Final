// Обсуждение под мероприятием (задача 1.8, сценарий 5 ТЗ): вопрос от любого вошедшего,
// ответ веткой, плашка «Организатор» у автора события, заглушка вместо скрытого сообщения.
import { COMMENT_MAX } from '@sport/shared/schemas/comments';
import type { Comment } from '@sport/shared/schemas/comments';
import type { EventDetails } from '@sport/shared/schemas/events';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  SkeletonList,
  TextareaField,
} from '../../shared/ui';
import { useMe } from '../auth/api';
import { useAddComment, useComments } from './api';
import { formatMoment } from './format';

export function Discussion({ event }: { event: EventDetails }) {
  const comments = useComments(event.id);
  const me = useMe();
  const location = useLocation();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const canWrite = event.permissions.canComment;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">Обсуждение</h2>
        <p className="text-sm text-ink-muted">
          Спросите организатора о месте, уровне или инвентаре — ответ увидят все.
        </p>
      </div>

      {comments.isPending && <SkeletonList count={2} />}
      {comments.isError && <ErrorState error={comments.error} onRetry={() => comments.refetch()} />}
      {comments.data?.length === 0 && (
        <p className="text-ink-muted">Вопросов пока нет. Задайте первый!</p>
      )}
      {comments.data && comments.data.length > 0 && (
        <ul className="flex flex-col gap-5">
          {comments.data.map((thread) => (
            <li key={thread.id} className="flex flex-col gap-3">
              <Message comment={thread} />
              {thread.replies.length > 0 && (
                <ul className="ml-6 flex flex-col gap-3 border-l-2 border-line-soft pl-4">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <Message comment={reply} />
                    </li>
                  ))}
                </ul>
              )}
              {canWrite &&
                (replyTo === thread.id ? (
                  <div className="ml-6 pl-4">
                    <CommentForm
                      eventId={event.id}
                      parentId={thread.id}
                      label={`Ответ для ${thread.author.name}`}
                      submitLabel="Ответить"
                      onDone={() => setReplyTo(null)}
                    />
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="ml-6 self-start"
                    onClick={() => setReplyTo(thread.id)}
                  >
                    Ответить
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <CommentForm eventId={event.id} label="Ваш вопрос" submitLabel="Отправить" />
      ) : !me.data ? (
        <ButtonLink
          variant="secondary"
          className="self-start"
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
        >
          Войти, чтобы задать вопрос
        </ButtonLink>
      ) : (
        event.status !== 'published' && (
          <p className="text-ink-muted">Событие снято с публикации, обсуждение закрыто.</p>
        )
      )}
    </Card>
  );
}

function Message({ comment }: { comment: Comment }) {
  const { author } = comment;
  return (
    <article className="flex gap-3">
      <Avatar name={author.name} size={40} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{author.name}</span>
          {author.badgeLabel && (
            // Длинное название организации переносится: плашка в ответе с отступом иначе
            // растягивала страницу события шире экрана телефона (360px).
            <span className="max-w-full [&>span]:whitespace-normal">
              <Badge tone={author.badge === 'moderator' ? 'neutral' : 'free'} icon={null}>
                {author.badgeLabel}
              </Badge>
            </span>
          )}
          <time dateTime={comment.createdAt} className="text-sm text-ink-muted">
            {formatMoment(comment.createdAt)}
          </time>
        </div>
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
  onDone,
}: {
  eventId: string;
  parentId?: string;
  label: string;
  submitLabel: string;
  onDone?: () => void;
}) {
  const add = useAddComment(eventId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Напишите сообщение');
      return;
    }
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
      {add.error && (
        <Alert>
          {add.error instanceof ApiError ? add.error.message : 'Не удалось отправить сообщение'}
        </Alert>
      )}
      <TextareaField
        label={label}
        rows={3}
        maxLength={COMMENT_MAX}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
        error={error}
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
