// Мелкие общие части экранов мероприятия: плашка вида спорта, строка с иконкой, ссылка на организатора.
import type { Organizer } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon, sportColor, sportIcon, type IconName } from '../../shared/ui';

/** Квадрат с иконкой вида спорта в его цвете — тот же, что у чипа и метки на карте. */
export function SportTile({ sport, size = 52 }: { sport: Pick<Sport, 'slug'>; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: sportColor(sport.slug) }}
      className="inline-flex shrink-0 items-center justify-center rounded-md border-2 border-ink"
    >
      <Icon name={sportIcon(sport.slug)} size={Math.round(size * 0.54)} strokeWidth={1.8} />
    </span>
  );
}

/** Строка сведений: иконка и текст («Когда», «Где», «Участники»). */
export function MetaLine({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-ink-muted">
      <Icon name={icon} size={18} className="mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

/** Организатор со ссылкой: страница организации (участник 2) или профиль человека. */
export function OrganizerLink({ organizer }: { organizer: Organizer }) {
  const to =
    organizer.type === 'organization' ? `/organizations/${organizer.id}` : `/users/${organizer.id}`;
  return (
    <Link to={to} className="font-semibold">
      {organizer.name}
    </Link>
  );
}
