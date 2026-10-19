// Карточка мероприятия для модерации: снять или удалить с причиной, скрыть сообщение (3.5, 3.6).
import type { AdminComment } from '@sport/shared/schemas/admin';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDateTime } from '../../shared/format';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  JoinModeBadge,
  SkeletonList,
  StatusBadge,
} from '../../shared/ui';
import { useAdminEvent, useEventModeration } from './api';
import { History } from './parts';
import { ReasonModal } from './ReasonModal';

type Dialog = { kind: 'unpublish' } | { kind: 'delete' } | { kind: 'hide'; comment: AdminComment };

export function EventPage() {
  const { id = '' } = useParams();
  const event = useAdminEvent(id);
  const moderation = useEventModeration(id);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (event.isPending) return <SkeletonList count={2} />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  const data = event.data;

  const mutation =
    dialog?.kind === 'unpublish'
      ? moderation.unpublish
      : dialog?.kind === 'delete'
        ? moderation.remove
        : moderation.hideComment;
  const close = () => {
    setDialog(null);
    mutation.reset();
  };
  const submit = (reason: string) => {
    if (!dialog) return;
    const options = { onSuccess: close };
    if (dialog.kind === 'unpublish') moderation.unpublish.mutate(reason, options);
    if (dialog.kind === 'delete') moderation.remove.mutate(reason, options);
    if (dialog.kind === 'hide')
      moderation.hideComment.mutate({ commentId: dialog.comment.id, reason }, options);
  };

  const organizerLink =
    data.organizer.type === 'organization'
      ? `/organizations/${data.organizer.id}`
      : `/users/${data.organizer.id}`;
  const roots = data.comments.filter((c) => !c.parentId);
  const repliesOf = (rootId: string) => data.comments.filter((c) => c.parentId === rootId);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/admin/events" className="font-semibold">
        ← Все мероприятия
      </Link>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-h2">{data.title}</h2>
            <p className="text-ink-muted">
              {data.sport.name} · {formatDateTime(data.startsAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <JoinModeBadge mode={data.joinMode} />
            <StatusBadge kind="event" status={data.status} />
          </div>
        </div>

        {data.moderationReason && (
          <Alert tone="warning">
            {data.status === 'deleted' ? 'Удалено' : 'Снято с публикации'}: {data.moderationReason}
          </Alert>
        )}

        <p className="whitespace-pre-line">{data.description}</p>

        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold">
            {data.organizer.type === 'organization' ? 'Организация' : 'Организатор'}
          </dt>
          <dd>
            <Link to={organizerLink}>{data.organizer.name}</Link>
          </dd>
          <dt className="font-semibold">Место</dt>
          <dd>{data.address}</dd>
          <dt className="font-semibold">Участников</dt>
          <dd>{data.participantsCount}</dd>
        </dl>

        <div className="flex flex-wrap gap-3">
          <ButtonLink to={`/events/${data.id}`} variant="secondary">
            Страница мероприятия
          </ButtonLink>
          {data.status === 'published' && (
            <Button variant="danger" onClick={() => setDialog({ kind: 'unpublish' })}>
              Снять с публикации
            </Button>
          )}
          {data.status !== 'deleted' && (
            <Button variant="danger" onClick={() => setDialog({ kind: 'delete' })}>
              Удалить
            </Button>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Обсуждение ({data.comments.length})</h2>
        {roots.length === 0 ? (
          <EmptyState icon="people" title="Сообщений пока нет" />
        ) : (
          <ul className="flex flex-col gap-3">
            {roots.map((comment) => (
              <li key={comment.id} className="flex flex-col gap-2">
                <CommentRow comment={comment} onHide={() => setDialog({ kind: 'hide', comment })} />
                {repliesOf(comment.id).map((reply) => (
                  <div key={reply.id} className="ml-6 sm:ml-10">
                    <CommentRow
                      comment={reply}
                      onHide={() => setDialog({ kind: 'hide', comment: reply })}
                    />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <History entries={data.history} />

      <ReasonModal
        open={dialog !== null}
        onClose={close}
        title={
          dialog?.kind === 'unpublish'
            ? 'Снять с публикации'
            : dialog?.kind === 'delete'
              ? 'Удалить мероприятие'
              : 'Скрыть сообщение'
        }
        hint={
          dialog?.kind === 'hide'
            ? 'Её увидят в журнале решений, автору сообщение покажется скрытым'
            : 'Её увидят организатор и записавшиеся'
        }
        confirmLabel={
          dialog?.kind === 'unpublish' ? 'Снять' : dialog?.kind === 'delete' ? 'Удалить' : 'Скрыть'
        }
        pending={mutation.isPending}
        error={mutation.error}
        onSubmit={submit}
      />
    </div>
  );
}

function CommentRow({ comment, onHide }: { comment: AdminComment; onHide: () => void }) {
  return (
    // article с подписью: экранный диктор объявляет каждое сообщение отдельно.
    <article
      aria-label={`Сообщение от ${comment.author.name}`}
      className={`flex flex-wrap items-start justify-between gap-3 rounded-md border-2 p-4 ${comment.isHidden ? 'border-line-soft bg-surface-muted' : 'border-ink bg-surface'}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">{comment.author.name}</span> ·{' '}
          {formatDateTime(comment.createdAt)}
        </div>
        <p className="break-words">{comment.text}</p>
        {comment.isHidden && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Скрыто</Badge>
            {comment.hiddenReason && (
              <span className="text-sm">Причина: {comment.hiddenReason}</span>
            )}
          </div>
        )}
      </div>
      {!comment.isHidden && (
        <Button variant="secondary" onClick={onHide}>
          Скрыть
        </Button>
      )}
    </article>
  );
}
