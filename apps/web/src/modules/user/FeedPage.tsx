// Главная: поиск, «Мои записи», чипы видов спорта, фильтры и лента ближайших встреч (задача 1.4).
// Фильтры живут в адресе страницы: ссылкой на подборку можно поделиться, «Назад» возвращает фильтр.
import { EVENT_LEVEL_LABELS, EVENT_LEVELS, JOIN_MODE_LABELS, JOIN_MODES } from '@sport/shared';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  SelectField,
  SkeletonList,
  SportChip,
  StatusBadge,
} from '../../shared/ui';
import { useMe } from '../auth/api';
import { EventsMap } from '../org/map';
import { useFeed, useMyRegistrations, useSports, type FeedParams } from './api';
import { EventCard } from './EventCard';
import { formatWhen, isoDay, LOCAL_TIME_NOTE } from './format';

const WHEN_OPTIONS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week', label: 'Ближайшие 7 дней' },
  { value: 'weekend', label: 'Выходные' },
] as const;

/** Диапазон дат по Красноярску для значения «Когда». */
function whenRange(when: string | null): Pick<FeedParams, 'dateFrom' | 'dateTo'> {
  switch (when) {
    case 'today':
      return { dateFrom: isoDay(0), dateTo: isoDay(0) };
    case 'tomorrow':
      return { dateFrom: isoDay(1), dateTo: isoDay(1) };
    case 'week':
      return { dateFrom: isoDay(0), dateTo: isoDay(6) };
    case 'weekend': {
      const weekday = new Date(`${isoDay(0)}T00:00:00Z`).getUTCDay(); // 0 — воскресенье
      const toSaturday = weekday === 0 ? -1 : 6 - weekday;
      return { dateFrom: isoDay(Math.max(0, toSaturday)), dateTo: isoDay(toSaturday + 1) };
    }
    default:
      return {};
  }
}

const oneOf = <T extends string>(values: readonly T[], value: string | null) =>
  values.includes(value as T) ? (value as T) : undefined;

export function FeedPage() {
  const [search, setSearch] = useSearchParams();
  const sportId = search.get('sport') ?? undefined;
  const when = search.get('when');
  const params: FeedParams = {
    q: search.get('q') ?? undefined,
    sportId,
    ...whenRange(when),
    joinMode: oneOf(JOIN_MODES, search.get('mode')),
    level: oneOf(EVENT_LEVELS, search.get('level')),
  };
  const view = search.get('view') === 'map' ? 'map' : 'list';
  const hasFilters = [...search.keys()].some((key) => key !== 'view');

  /** Поменять один параметр адреса, остальные сохранить; пустое значение убирает параметр. */
  const setParam = (key: string, value: string | undefined) => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <h1 className="text-h1-mobile leading-tight md:text-h1">
            Больше, чем спорт —{' '}
            <span className="rounded-[14px] bg-accent px-3 box-decoration-clone">это люди</span>
          </h1>
          <p className="max-w-2xl text-lg text-ink-muted">
            Смотрите, кто и где собирается, читайте условия и присоединяйтесь. Футбол, шахматы,
            пробежки, зарядка во дворе — в одном месте.
          </p>
          <SearchForm
            key={params.q ?? ''}
            initial={params.q ?? ''}
            onSearch={(q) => setParam('q', q)}
          />
          <CreateEventLink />
        </div>
        <MyRegistrations />
      </section>

      <SportFilter sportId={sportId} onChange={(id) => setParam('sport', id)} />

      <section aria-label="Фильтры" className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Когда"
          placeholder="Любая дата"
          options={WHEN_OPTIONS}
          value={when ?? ''}
          onChange={(e) => setParam('when', e.target.value)}
        />
        <SelectField
          label="Режим записи"
          placeholder="Любой"
          options={JOIN_MODES.map((value) => ({ value, label: JOIN_MODE_LABELS[value] }))}
          value={params.joinMode ?? ''}
          onChange={(e) => setParam('mode', e.target.value)}
        />
        <SelectField
          label="Уровень"
          placeholder="Любой"
          options={EVENT_LEVELS.map((value) => ({ value, label: EVENT_LEVEL_LABELS[value] }))}
          value={params.level ?? ''}
          onChange={(e) => setParam('level', e.target.value)}
        />
      </section>

      <ViewSwitch view={view} onChange={(next) => setParam('view', next === 'map' ? next : '')} />

      {view === 'map' ? (
        // «Место встречи» (1.10): та же подборка, что в списке, метками на карте.
        <section aria-label="Встречи на карте" className="flex flex-col gap-3">
          <p className="text-ink-muted">
            Метка — встреча, цвет — вид спорта, замок — запись по заявке. {LOCAL_TIME_NOTE}.
          </p>
          <EventsMap filters={params} className="h-[60vh] min-h-[420px]" />
        </section>
      ) : (
        <Feed
          params={params}
          hasFilters={hasFilters}
          onReset={() => setSearch({}, { replace: true })}
        />
      )}
    </div>
  );
}

/** «Список / Карта»: та же подборка списком или метками на карте. */
function ViewSwitch({
  view,
  onChange,
}: {
  view: 'list' | 'map';
  onChange: (view: 'list' | 'map') => void;
}) {
  return (
    <div role="group" aria-label="Как показать встречи" className="flex flex-wrap gap-2.5">
      <Chip pressed={view === 'list'} icon="all" onClick={() => onChange('list')}>
        Список
      </Chip>
      <Chip pressed={view === 'map'} icon="map" index={1} onClick={() => onChange('map')}>
        Карта
      </Chip>
    </div>
  );
}

/** «Создать встречу»: участнику и организации; без входа форма сначала попросит войти. */
function CreateEventLink() {
  const me = useMe();
  if (me.data?.role === 'admin') return null;
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span className="text-ink-muted">Не нашли подходящую встречу?</span>
      <ButtonLink to="/events/new" variant="dark">
        <Icon name="plus" />
        Создать встречу
      </ButtonLink>
    </p>
  );
}

function SearchForm({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(text.trim());
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex max-w-3xl flex-wrap gap-2.5 rounded-[22px] border-2 border-ink bg-surface p-2.5 shadow-md"
    >
      <label className="flex min-w-0 flex-[1_1_240px] flex-col px-3 py-1.5">
        <span className="text-sm font-semibold text-ink-muted">Чем заняться</span>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Бег, шахматы, йога…"
          className="bg-transparent py-0.5 text-lg outline-none placeholder:text-ink-muted"
        />
      </label>
      <Button type="submit" size="lg">
        <Icon name="search" />
        Найти
      </Button>
    </form>
  );
}

/** Чипы видов спорта, у которых есть ближайшие встречи. Повторное нажатие снимает выбор. */
function SportFilter({
  sportId,
  onChange,
}: {
  sportId: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const sports = useSports({ withEvents: true });
  if (!sports.data?.length) return null;
  return (
    <section aria-label="Виды спорта" className="flex flex-wrap gap-3">
      <Chip pressed={!sportId} icon="all" onClick={() => onChange(undefined)}>
        Все
      </Chip>
      {sports.data.map((sport, index) => (
        <SportChip
          key={sport.id}
          sport={sport}
          index={index + 1}
          pressed={sport.id === sportId}
          onClick={() => onChange(sport.id === sportId ? undefined : sport.id)}
        />
      ))}
    </section>
  );
}

/** Ближайшие записи участника: статус видно сразу на главной, без перехода в профиль. */
function MyRegistrations() {
  const me = useMe();
  const isParticipant = me.data?.role === 'user';
  const mine = useMyRegistrations(isParticipant);
  if (!isParticipant || !mine.data) return null;

  return (
    <aside aria-label="Мои записи" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
      <Card className="flex rotate-[-1.5deg] flex-col gap-3 p-5">
        <h2 className="text-h3">Мои записи</h2>
        {mine.data.items.length === 0 ? (
          <p className="text-ink-muted">Вы пока никуда не записаны. Выберите встречу ниже.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.data.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <Link to={`/events/${item.id}`} className="font-semibold">
                  {item.title}
                </Link>
                <span className="text-sm text-ink-muted">
                  {formatWhen(item.startsAt, item.endsAt)}
                </span>
                <span>
                  {item.status === 'published' ? (
                    <StatusBadge kind="registration" status={item.myRegistration.status} />
                  ) : (
                    <StatusBadge kind="event" status={item.status} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );
}

function Feed({
  params,
  hasFilters,
  onReset,
}: {
  params: FeedParams;
  hasFilters: boolean;
  onReset: () => void;
}) {
  const feed = useFeed(params);

  const heading = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-h2">Ближайшие встречи</h2>
      <span className="text-sm text-ink-muted">
        {feed.data ? `Найдено: ${feed.data.pages[0].total}. ` : ''}
        {LOCAL_TIME_NOTE}
      </span>
    </div>
  );

  if (feed.isPending) {
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <SkeletonList count={4} />
      </section>
    );
  }
  if (feed.isError) {
    return (
      <section className="flex flex-col gap-4">
        {heading}
        <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
      </section>
    );
  }

  const events = feed.data.pages.flatMap((page) => page.items);
  return (
    <section className="flex flex-col gap-4" aria-busy={feed.isFetching || undefined}>
      {heading}
      {events.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'По этим условиям встреч нет' : 'Пока нет встреч'}
          text={
            hasFilters
              ? 'Попробуйте другую дату или вид спорта.'
              : 'Скоро здесь появятся встречи соседей, клубов и сообществ.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={onReset}>
                Сбросить фильтры
              </Button>
            ) : (
              <ButtonLink to="/events/new">Создать встречу</ButtonLink>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      {feed.hasNextPage && (
        <Button
          variant="secondary"
          className="self-center"
          loading={feed.isFetchingNextPage}
          onClick={() => feed.fetchNextPage()}
        >
          Показать ещё
        </Button>
      )}
    </section>
  );
}
