// Шапка главной, вариант Б2: площадка меняется под выбранный вид спорта — поле, дорожка,
// бассейн, паркет, доска, стол, коврик, а свой вид спорта — площадка с фишками. Вместе с ней
// меняется заголовок.
import type { Sport } from '@sport/shared/schemas/sports';
import type { ReactNode } from 'react';
import { Icon, sportColor, sportIcon, type IconName } from '../../shared/ui';
import { Plate, SportSurface, surfaceFor, type SurfaceKind } from './surface/SportSurface';

/** Заголовок под покрытие: призыв и табличка. Без выбранного вида спорта — поле. */
const TITLES: Record<SurfaceKind, [string, string]> = {
  football: ['Выходи на поле', 'компания уже есть'],
  court: ['На площадку', 'соберём команду'],
  track: ['На старт', 'компания на дистанцию'],
  pool: ['Ныряй', 'дорожка свободна'],
  chess: ['Твой ход', 'партнёр рядом'],
  table: ['Подача', 'сыграем пару сетов'],
  yoga: ['На коврик', 'занимаемся вместе'],
  custom: ['Своё направление', 'площадка найдётся'],
  corner: ['Выходи на поле', 'компания уже есть'],
};

export function HomeHero({
  sports,
  sportId,
  onSport,
  search,
}: {
  /** Самые популярные виды спорта с ближайшими встречами (и выбранный, если он не из них). */
  sports: Sport[];
  sportId: string | undefined;
  onSport: (id: string | undefined) => void;
  /** Форма поиска «Чем заняться / Где / Когда». */
  search: ReactNode;
}) {
  const selected = sports.find((sport) => sport.id === sportId);
  const kind = selected ? surfaceFor(selected.slug) : 'football';
  const [call, plate] = TITLES[kind];

  return (
    <SportSurface
      kind={kind}
      className="rounded-xl border-2 border-ink px-4 py-8 shadow-md transition-[background] sm:px-8 sm:py-10"
    >
      <div className="mx-auto flex max-w-[920px] flex-col items-center gap-6 text-center">
        {/* Unbounded широкий: на телефоне заголовок мельче, иначе занимает четыре строки. */}
        <h1 className="text-[26px] leading-[1.35] sm:text-h1-mobile md:text-h1 md:leading-[1.25]">
          <Plate className="bg-surface/85">{call}</Plate> —{' '}
          <Plate className="inline-block -rotate-1">{plate}</Plate>
        </h1>
        {search}
        <SportBalls sports={sports} sportId={sportId} onSport={onSport} />
      </div>
    </SportSurface>
  );
}

/**
 * Виды спорта — круглые значки в цвете вида, только самые популярные: остальные находятся
 * поиском «Чем заняться». Выбранный обведён. На телефоне — одна строка с прокруткой вбок.
 */
function SportBalls({
  sports,
  sportId,
  onSport,
}: {
  sports: Sport[];
  sportId: string | undefined;
  onSport: (id: string | undefined) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Вид спорта"
      className="-mx-4 flex max-w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pt-1 pb-2 sm:mx-0 sm:max-w-full sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 [&>*]:shrink-0"
    >
      <Ball
        label="Все"
        icon="all"
        color="var(--color-accent)"
        pressed={!sportId}
        onClick={() => onSport(undefined)}
      />
      {sports.map((sport) => (
        <Ball
          key={sport.id}
          label={sport.name}
          icon={sportIcon(sport.slug)}
          color={sportColor(sport.slug)}
          pressed={sport.id === sportId}
          onClick={() => onSport(sport.id === sportId ? undefined : sport.id)}
        />
      ))}
    </div>
  );
}

const BALL_CLASS =
  'group flex min-h-[var(--control-height)] min-w-[68px] cursor-pointer flex-col items-center gap-1 px-1 text-sm font-semibold';
const CIRCLE_CLASS =
  'inline-flex size-12 items-center justify-center rounded-full border-2 border-ink shadow-sm transition-[translate] duration-100 group-hover:-translate-y-0.5';

function Ball({
  label,
  icon,
  color,
  pressed,
  onClick,
}: {
  label: string;
  icon: IconName;
  color: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={BALL_CLASS}>
      <span
        className={`${CIRCLE_CLASS} ${pressed ? 'outline-3 outline-offset-2 outline-ink' : ''}`}
        style={{ background: color }}
      >
        <Icon name={icon} size={24} strokeWidth={2} />
      </span>
      <BallLabel>{label}</BallLabel>
    </button>
  );
}

/** Подпись на светлой подложке: на разметке площадки текст без неё теряется. */
function BallLabel({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-surface/85 px-1.5 whitespace-nowrap">{children}</span>;
}
