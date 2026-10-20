// Кабинет организации (задачи 2.2, 2.3): подача заявки, сводка «допуск · оценка · встречи»,
// анкета и отзывы участников, правка данных и повторная подача после отказа.
import type { OrgStatus } from '@sport/shared';
import { EVENT_TIMEZONE } from '@sport/shared/schemas/events';
import type { OrganizationOwner } from '@sport/shared/schemas/organizations';
import {
  RATING_MIN_REVIEWS,
  REVIEW_TAG_LABELS,
  type OrganizationReviews,
  type Review,
  type ReviewTag,
} from '@sport/shared/schemas/reviews';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Icon,
  SkeletonList,
  type IconName,
} from '../../shared/ui';
import { useMyEvents, useOrganizationReviews } from '../user/api';
import { plural } from '../user/format';
import { ReviewItems } from '../user/reviews/ReviewList';
import { formatRating, Stars } from '../user/reviews/Stars';
import {
  useCreateOrganization,
  useMyOrganization,
  useResubmitOrganization,
  useUpdateOrganization,
} from './api';
import { formErrors } from './errors';
import { OrganizationForm } from './OrganizationForm';
import { SportTag } from './SportTag';

/** Маршрут /org: кабинет доступен только аккаунту организации. */
export function OrgCabinetRoute() {
  return (
    <RequireAuth roles={['organization']}>
      <OrgCabinetPage />
    </RequireAuth>
  );
}

export function OrgCabinetPage() {
  const mine = useMyOrganization();

  if (mine.isPending) return <SkeletonList count={2} />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />;
  return mine.data ? <Cabinet org={mine.data} /> : <Apply />;
}

function Apply() {
  const create = useCreateOrganization();
  const { message, fields } = formErrors(create.error, 'Не удалось отправить заявку');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-h2 mb-2">Заявка на допуск организации</h1>
        <p className="text-ink-muted">
          Расскажите о клубе или сообществе. Администратор проверит заявку, после допуска у
          организации появится своя страница, а события будут публиковаться сразу.
        </p>
      </div>
      <Steps status={null} />
      <Card>
        <OrganizationForm
          submitLabel="Отправить заявку"
          pendingLabel="Отправляем…"
          pending={create.isPending}
          requestError={message}
          serverFields={fields}
          onSubmit={(body) => create.mutate(body)}
        />
      </Card>
    </div>
  );
}

function Cabinet({ org }: { org: OrganizationOwner }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const update = useUpdateOrganization();
  const resubmit = useResubmitOrganization();
  const rejected = org.status === 'rejected';
  const approved = org.status === 'approved';
  // Отзывы и встречи бывают только у допущенного клуба, остальным их не запрашиваем.
  const reviews = useOrganizationReviews(org.id, approved);
  const upcoming = useMyEvents(approved);
  const { message, fields } = formErrors(update.error, 'Не удалось сохранить изменения');
  const resubmitError = formErrors(resubmit.error, 'Не удалось подать заявку').message;

  const startEdit = () => {
    setSaved(null);
    update.reset();
    resubmit.reset();
    setEditing(true);
  };
  const done = (text: string) => {
    setEditing(false);
    setSaved(text);
  };
  const side = approved || rejected;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-h2">{org.name}</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatusTile org={org} />
        <RatingTile approved={approved} reviews={reviews} />
        <MeetingsTile
          approved={approved}
          organized={reviews.data?.summary.organized}
          upcoming={upcoming.data?.total}
        />
      </div>

      {saved && !editing && <Alert tone="success">{saved}</Alert>}

      {editing ? (
        <Card>
          <h2 className="text-h3 mb-4">Данные организации</h2>
          <OrganizationForm
            initial={org}
            submitLabel={rejected ? 'Сохранить и подать заново' : 'Сохранить'}
            pendingLabel={rejected ? 'Отправляем…' : 'Сохраняем…'}
            pending={update.isPending || resubmit.isPending}
            requestError={message ?? resubmitError}
            serverFields={fields}
            onSubmit={(body) =>
              update.mutate(body, {
                onSuccess: () => {
                  if (!rejected) return done('Изменения сохранены');
                  // После отказа правка и повторная подача — одно действие, а не две кнопки.
                  resubmit.mutate(undefined, {
                    onSuccess: () => done('Заявка отправлена снова. Решение появится здесь.'),
                  });
                },
              })
            }
            onCancel={() => {
              update.reset();
              resubmit.reset();
              setEditing(false);
            }}
          />
        </Card>
      ) : (
        <div className={`grid items-start gap-6 ${side ? 'lg:grid-cols-2' : ''}`}>
          <Profile org={org} onEdit={startEdit} />
          {rejected && <Rejection reason={org.rejectionReason} onFix={startEdit} />}
          {approved && <ReviewsPanel orgId={org.id} reviews={reviews.data} />}
        </div>
      )}
    </div>
  );
}

const dayMonthFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: EVENT_TIMEZONE,
  day: 'numeric',
  month: 'long',
});

const STATUS_TILES = {
  approved: { tone: 'bg-status-success', icon: 'check', title: 'Допущена' },
  pending: { tone: 'bg-status-warning', icon: 'clock', title: 'На проверке' },
  rejected: { tone: 'bg-status-danger', icon: 'cross', title: 'Отклонена' },
} as const satisfies Record<OrgStatus, { tone: string; icon: IconName; title: string }>;

/** Плитка сводки: крупное слово или число сверху, пояснение под ним. */
function Tile({ className = 'bg-surface', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border-2 border-ink p-5 shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

function BigValue({ children, size = 'text-[34px]' }: { children: ReactNode; size?: string }) {
  return (
    <span className={`font-display ${size} leading-tight font-bold tabular-nums`}>{children}</span>
  );
}

/** Статус допуска одной плиткой — вместо полосы шагов и отдельного блока с той же фразой. */
function StatusTile({ org }: { org: OrganizationOwner }) {
  const tile = STATUS_TILES[org.status];
  const since = org.reviewedAt ? `С ${dayMonthFormat.format(new Date(org.reviewedAt))} · ` : '';
  const text =
    org.status === 'approved'
      ? `${since}встречи публикуются сразу, без проверки`
      : org.status === 'pending'
        ? 'Решение появится здесь. До него публиковать встречи нельзя.'
        : 'Администратор вернул заявку на доработку.';
  return (
    <Tile className={tile.tone}>
      <p className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface">
          <Icon name={tile.icon} size={22} />
        </span>
        {/* Слово длиннее цифры: «На проверке» должно влезть в плитку одной строкой. */}
        <BigValue size="text-[30px]">{tile.title}</BigValue>
      </p>
      <p>{text}</p>
    </Tile>
  );
}

type ReviewsQuery = ReturnType<typeof useOrganizationReviews>;

function RatingTile({ approved, reviews }: { approved: boolean; reviews: ReviewsQuery }) {
  const summary = reviews.data?.summary;
  if (approved && summary && summary.rating !== null) {
    return (
      <Tile>
        <p className="flex flex-wrap items-center gap-3">
          <BigValue>{formatRating(summary.rating)}</BigValue>
          <Stars rating={summary.rating} size={24} />
        </p>
        <p className="text-ink-muted">Оценка участников · {plural(summary.count, REVIEWS)}</p>
      </Tile>
    );
  }
  const text = !approved
    ? 'Оценки появятся после допуска и первых встреч'
    : reviews.isPending
      ? 'Загружаем отзывы…'
      : !summary
        ? 'Не удалось загрузить отзывы'
        : summary.count > 0
          ? `Отзывов пока ${summary.count}, оценка появится от ${RATING_MIN_REVIEWS}`
          : 'Оценки появятся после первых встреч';
  return (
    <Tile>
      <BigValue>—</BigValue>
      <p className="text-ink-muted">{text}</p>
    </Tile>
  );
}

function MeetingsTile({
  approved,
  organized,
  upcoming,
}: {
  approved: boolean;
  organized: number | undefined;
  upcoming: number | undefined;
}) {
  return (
    <Tile>
      <BigValue>{approved && organized !== undefined ? organized : '—'}</BigValue>
      <p className="text-ink-muted">
        {approved ? 'Проведено встреч' : 'Встречи появятся после допуска'}
        {approved && upcoming ? (
          <>
            {' · '}
            <Link to="/me/events">ещё {upcoming} впереди</Link>
          </>
        ) : null}
      </p>
    </Tile>
  );
}

function Rejection({ reason, onFix }: { reason: string | null; onFix: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h3">Что исправить</h2>
      <p className="whitespace-pre-line">
        {reason ?? 'Администратор не указал причину. Проверьте данные и подайте заявку снова.'}
      </p>
      <Button className="self-start" onClick={onFix}>
        Исправить и подать снова
      </Button>
    </Card>
  );
}

const REVIEWS = ['отзыв', 'отзыва', 'отзывов'] as const;

/** «Дружелюбная атмосфера ×2»: какие отметки участники ставят клубу чаще всего. */
function tagCounts(items: Review[]) {
  const counts = new Map<ReviewTag, number>();
  for (const review of items) {
    for (const tag of review.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function ReviewsPanel({ orgId, reviews }: { orgId: string; reviews?: OrganizationReviews }) {
  if (!reviews) return null;
  const items = reviews.items.filter((review) => review.direction === 'participant_to_organizer');
  if (items.length === 0) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-h3">Что отмечают участники</h2>
        <p className="text-ink-muted">
          Отзывов пока нет. Они появятся после встреч клуба, когда участники их оценят.
        </p>
      </Card>
    );
  }
  const latest = items.filter((review) => review.comment).slice(0, 2);
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h3">Что отмечают участники</h2>
      <ul className="flex flex-wrap gap-2">
        {tagCounts(items).map(([tag, count]) => (
          <li key={tag}>
            <Badge tone="success" icon={null}>
              {REVIEW_TAG_LABELS[tag]}
              {count > 1 ? ` ×${count}` : ''}
            </Badge>
          </li>
        ))}
      </ul>
      {latest.length > 0 && <ReviewItems items={latest} empty="" />}
      <Link to={`/organizations/${orgId}`} className="self-start font-semibold">
        Все отзывы на странице клуба →
      </Link>
    </Card>
  );
}

function Profile({ org, onEdit }: { org: OrganizationOwner; onEdit: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-h3">Данные организации</h2>
        <Button variant="secondary" onClick={onEdit}>
          Изменить
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Вид объединения</dt>
        <dd>{org.activity}</dd>
        <dt className="font-semibold">Город</dt>
        <dd>{org.city ?? 'Не указан'}</dd>
        <dt className="font-semibold">Контакты</dt>
        <dd className="break-words">{org.contacts ?? 'Не указаны'}</dd>
      </dl>
      <p className="whitespace-pre-line">{org.description}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {org.sports.map((sport) => (
          <SportTag key={sport.id} sport={sport} />
        ))}
        <Link to={`/organizations/${org.id}`} className="font-semibold">
          Публичная страница →
        </Link>
      </div>
    </Card>
  );
}

const STEPS = ['Подача заявки', 'Проверка администратором', 'Организация допущена'];

/** Где сейчас заявка: понятная полоса из трёх шагов. */
function Steps({ status }: { status: OrgStatus | null }) {
  const current = status === null ? 0 : status === 'approved' ? 3 : 1;
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Этапы допуска">
      {STEPS.map((title, index) => {
        const done = index < current;
        const active = index === current && status !== 'rejected';
        const failed = status === 'rejected' && index === 1;
        return (
          <li
            key={title}
            aria-current={active ? 'step' : undefined}
            className={[
              'flex items-center gap-3 rounded-md border-2 p-3 font-semibold',
              done ? 'border-ink bg-status-success' : '',
              failed ? 'border-ink bg-status-danger' : '',
              active ? 'border-ink bg-status-warning' : '',
              !done && !failed && !active ? 'border-line-soft bg-surface text-ink-muted' : '',
            ].join(' ')}
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface">
              {done ? (
                <Icon name="check" size={18} />
              ) : failed ? (
                <Icon name="cross" size={18} />
              ) : (
                index + 1
              )}
            </span>
            {failed ? 'Заявка отклонена' : title}
          </li>
        );
      })}
    </ol>
  );
}
