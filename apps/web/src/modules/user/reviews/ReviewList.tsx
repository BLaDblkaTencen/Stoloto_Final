// Где видна оценка: строка у организатора в карточке встречи, надёжность в заявке, вкладка
// «Отзывы» в профиле и раздел на странице клуба. Один набор частей, чтобы цифры везде читались одинаково.
import {
  REVIEW_TAG_LABELS,
  RATING_MIN_REVIEWS,
  type OrganizerSummary,
  type ParticipantSummary,
  type Review,
} from '@sport/shared/schemas/reviews';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar, Badge, Card, EmptyState, ErrorState, SkeletonList } from '../../../shared/ui';
import { useOrganizationReviews, useUserReviews } from '../api';
import { formatShort, plural } from '../format';
import { formatRating, Stars } from './Stars';

const REVIEWS = ['отзыв', 'отзыва', 'отзывов'] as const;

/** «★★★★★ 4,8 · 4 отзыва» или «Новый организатор», пока отзывов меньше трёх. */
export function OrganizerRating({ summary }: { summary: OrganizerSummary }) {
  if (summary.rating === null) return <Badge tone="free">Новый организатор</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      <Stars rating={summary.rating} />
      <span className="font-semibold">{formatRating(summary.rating)}</span>
      <span className="text-ink-muted">· {plural(summary.count, REVIEWS)}</span>
    </span>
  );
}

/** Для решения по заявке: «★ 4,7 · приходит на 5 из 6 встреч · 1 неявка». */
export function Reliability({ summary }: { summary: ParticipantSummary }) {
  if (summary.total === 0) {
    return (
      <span className="text-sm text-ink-muted">Новый участник: прошедших встреч пока нет</span>
    );
  }
  const noShows = summary.total - summary.attended;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-sm">
      {summary.rating !== null && (
        <>
          <Stars rating={summary.rating} size={16} />
          <span className="font-semibold">{formatRating(summary.rating)}</span>
          <span aria-hidden="true">·</span>
        </>
      )}
      <span>
        приходит на {summary.attended} из {plural(summary.total, ['встречи', 'встреч', 'встреч'])}
      </span>
      {noShows > 0 && (
        <Badge tone="danger" icon={null}>
          {plural(noShows, ['неявка', 'неявки', 'неявок'])}
        </Badge>
      )}
    </span>
  );
}

/** Крупная цифра оценки с подписью: в профиле и на странице клуба. */
function ScoreCard({
  title,
  rating,
  count,
  empty,
  facts,
}: {
  title: string;
  rating: number | null;
  count: number;
  empty: string;
  facts: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-h3">{title}</h3>
      {rating === null ? (
        <p className="text-ink-muted">
          {empty}
          {count > 0 && ` Отзывов пока ${count}, оценка появится от ${RATING_MIN_REVIEWS}.`}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-[44px] leading-none font-bold">
            {formatRating(rating)}
          </span>
          <span className="flex flex-col gap-1">
            <Stars rating={rating} size={20} />
            <span className="text-sm text-ink-muted">{plural(count, REVIEWS)}</span>
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-sm">{facts}</div>
    </Card>
  );
}

function Fact({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border-2 border-ink bg-surface-muted px-3 py-1.5 tabular-nums">
      {children}
    </span>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const authorLink =
    review.author.type === 'organization'
      ? `/organizations/${review.author.id}`
      : `/users/${review.author.id}`;
  return (
    <li className="flex flex-col gap-2 border-t-2 border-dashed border-line-soft py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <Avatar name={review.author.name} size={36} />
          <Link to={authorLink} className="font-semibold">
            {review.author.name}
          </Link>
        </span>
        {review.rating !== null && <Stars rating={review.rating} />}
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <Badge icon={null}>
          {review.direction === 'participant_to_organizer'
            ? 'Отзыв участника'
            : 'Отзыв организатора'}
        </Badge>
        <span>
          <Link to={`/events/${review.event.id}`}>{review.event.title}</Link> ·{' '}
          {formatShort(review.event.startsAt)}
        </span>
      </p>
      {review.attended === false && (
        <span className="self-start">
          <Badge tone="danger">Не было на встрече</Badge>
        </span>
      )}
      {review.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.tags.map((tag) => (
            <Badge key={tag} tone="success" icon={null}>
              {REVIEW_TAG_LABELS[tag]}
            </Badge>
          ))}
        </div>
      )}
      {review.comment && <p className="whitespace-pre-line">{review.comment}</p>}
    </li>
  );
}

/** Список отзывов: на странице клуба, в профиле и в кабинете организации. */
export function ReviewItems({ items, empty }: { items: Review[]; empty: string }) {
  if (items.length === 0) return <p className="text-ink-muted">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </ul>
  );
}

/** Вкладка «Отзывы» в профиле: человек как организатор и как участник, ниже сами отзывы. */
export function ProfileReviews({ userId }: { userId: string }) {
  const reviews = useUserReviews(userId);
  if (reviews.isPending) return <SkeletonList count={2} />;
  if (reviews.isError) {
    return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />;
  }
  const { asOrganizer, asParticipant, items } = reviews.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard
          title="Как организатор"
          rating={asOrganizer.rating}
          count={asOrganizer.count}
          empty="Новый организатор: отзывов пока мало."
          facts={<Fact>Проведено встреч: {asOrganizer.organized}</Fact>}
        />
        <ScoreCard
          title="Как участник"
          rating={asParticipant.rating}
          count={asParticipant.count}
          empty="Оценок от организаторов пока мало."
          facts={
            <Fact>
              {asParticipant.total === 0
                ? 'Прошедших встреч пока нет'
                : `Приходит на встречи: ${asParticipant.attended} из ${asParticipant.total}`}
            </Fact>
          }
        />
      </div>
      <Card>
        <ReviewItems
          items={items}
          empty="Отзывов пока нет. Они появляются после встреч, когда обе стороны оценят друг друга."
        />
      </Card>
    </div>
  );
}

/** Раздел «Отзывы участников» на странице допущенного клуба. */
export function OrganizationReviewsSection({ orgId }: { orgId: string }) {
  const reviews = useOrganizationReviews(orgId, true);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h3">Отзывы участников</h2>
      {reviews.isPending ? (
        <SkeletonList count={1} />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : reviews.data.items.length === 0 && reviews.data.summary.count === 0 ? (
        <EmptyState
          title="Отзывов пока нет"
          text="Они появятся после встреч клуба: участники оценивают их в «Моих мероприятиях»."
        />
      ) : (
        <>
          <ScoreCard
            title="Оценка клуба"
            rating={reviews.data.summary.rating}
            count={reviews.data.summary.count}
            empty="Новый организатор: отзывов пока мало."
            facts={<Fact>Проведено встреч: {reviews.data.summary.organized}</Fact>}
          />
          <Card>
            <ReviewItems items={reviews.data.items} empty="Отзывов с текстом пока нет." />
          </Card>
        </>
      )}
    </section>
  );
}
