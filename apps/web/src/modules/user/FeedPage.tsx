// Главная (задачи 1.4, 1.10), вариант Б2 + К1 после экспертной сессии: площадка под выбранный
// вид спорта с поиском, ниже лента по дням рядом с картой. Режим записи и уровень — в «Фильтрах»,
// «Мои записи» — одна ближайшая строкой. Гостю внизу — «Как это работает» и «Клуб или сообщество?».
// Фильтры живут в адресе страницы: ссылкой на подборку можно поделиться, «Назад» возвращает фильтр.
import { EVENT_LEVEL_LABELS, EVENT_LEVELS, JOIN_MODE_LABELS, JOIN_MODES } from '@sport/shared';
import type { EventListItem } from '@sport/shared/schemas/events';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Icon,
  JoinModeBadge,
  Listbox,
  SelectField,
  SkeletonList,
  sportColor,
  sportIcon,
  StatusBadge,
} from '../../shared/ui';
import { useMe } from '../auth/api';
import { EventsMap, type MapFocus } from '../org/map';
import { useFeed, useJoinEvent, useMyRegistrations, useSports, type FeedParams } from './api';
import {
  eventDay,
  formatDayHeading,
  formatShort,
  DEVICE_TIMEZONE,
  formatTime,
  isoDay,
  LOCAL_TIME_NOTE,
  plural,
} from './format';
import { HomeHero } from './HomeHero';

const WHEN_OPTIONS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'tomorrow', label: 'Завтра' },
  { value: 'week', label: 'Ближайшие 7 дней' },
  { value: 'weekend', label: 'Выходные' },
] as const;

/** Диапазон дат на устройстве для значения «Когда»: сервер считает сутки в том же поясе (tz). */
function whenRange(when: string | null): Pick<FeedParams, 'dateFrom' | 'dateTo' | 'tz'> {
  const range = (from: number, to: number) => ({
    dateFrom: isoDay(from),
    dateTo: isoDay(to),
    tz: DEVICE_TIMEZONE,
  });
  switch (when) {
    case 'today':
      return range(0, 0);
    case 'tomorrow':
      return range(1, 1);
    case 'week':
      return range(0, 6);
    case 'weekend': {
      const weekday = new Date(`${isoDay(0)}T00:00:00Z`).getUTCDay(); // 0 — воскресенье
      const toSaturday = weekday === 0 ? -1 : 6 - weekday;
      return range(Math.max(0, toSaturday), toSaturday + 1);
    }
    default:
      return {};
  }
}

const oneOf = <T extends string>(values: readonly T[], value: string | null) =>
  values.includes(value as T) ? (value as T) : undefined;

// Список и карта рядом — с ширины lg (как в макете); уже — переключатель «Список / Карта».
const WIDE_QUERY = '(min-width: 1024px)';

function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
  );
}

type View = 'list' | 'map';

export function FeedPage() {
  const me = useMe();
  const [search, setSearch] = useSearchParams();
  const when = search.get('when') ?? '';
  const params: FeedParams = {
    q: search.get('q') ?? undefined,
    place: search.get('place') ?? undefined,
    sportId: search.get('sport') ?? undefined,
    ...whenRange(when),
    joinMode: oneOf(JOIN_MODES, search.get('mode')),
    level: oneOf(EVENT_LEVELS, search.get('level')),
  };
  const view: View = search.get('view') === 'map' ? 'map' : 'list';
  const hasFilters = [...search.keys()].some((key) => key !== 'view');

  /** Поменять параметры адреса, остальные сохранить; пустое значение убирает параметр. */
  const setParams = (changes: Record<string, string | undefined>) => {
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  // Значки — шесть самых популярных видов. Выбранный по ссылке вид вне шестёрки (из интересов
  // в профиле) добавляем к ним, иначе фильтр работал бы, а значка у него не было.
  const top = useSports({ top: 6 });
  const withEvents = useSports({ withEvents: true });
  const selected = withEvents.data?.find((sport) => sport.id === params.sportId);
  const sports = [
    ...(top.data ?? []),
    ...(selected && !top.data?.some((sport) => sport.id === selected.id) ? [selected] : []),
  ];

  return (
    // pb-6: зазор до подвала один для всех — у гостя страница кончается «Клуб или сообщество?»,
    // у вошедшего — лентой с картой.
    <div className="flex flex-col gap-8 pb-6">
      <HomeHero
        sports={sports}
        sportId={params.sportId}
        onSport={(id) => setParams({ sport: id })}
        search={
          <SearchForm
            key={`${params.q ?? ''}|${params.place ?? ''}`}
            q={params.q ?? ''}
            place={params.place ?? ''}
            when={when}
            onSearch={setParams}
          />
        }
      />

      <NextRegistration />

      <EventsSplit
        params={params}
        hasFilters={hasFilters}
        onReset={() => setSearch({}, { replace: true })}
        view={view}
        onView={(next) => setParams({ view: next === 'map' ? next : undefined })}
        onParam={(key, value) => setParams({ [key]: value })}
      />

      <Steps />
      <OrgInvite />
    </div>
  );
}

function SearchForm({
  q,
  place,
  when,
  onSearch,
}: {
  q: string;
  place: string;
  when: string;
  onSearch: (changes: Record<string, string | undefined>) => void;
}) {
  const [text, setText] = useState(q);
  const [where, setWhere] = useState(place);
  const whenLabelId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch({ q: text.trim() || undefined, place: where.trim() || undefined });
  };
  return (
    <form
      role="search"
      onSubmit={submit}
      className="grid w-full max-w-[860px] gap-2.5 rounded-[22px] border-2 border-ink bg-surface p-2.5 text-left shadow-md md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="grid sm:grid-cols-3">
        <SearchField label="Чем заняться">
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Бег, шахматы, йога…"
            className="min-w-0 bg-transparent py-0.5 text-lg outline-none placeholder:text-ink-muted"
          />
        </SearchField>
        <SearchField label="Где" divider>
          <input
            type="search"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            placeholder="Улица, парк, площадка"
            className="min-w-0 bg-transparent py-0.5 text-lg outline-none placeholder:text-ink-muted"
          />
        </SearchField>
        <SearchField label="Когда" labelId={whenLabelId} divider>
          {/* Дата применяется сразу: выбор из списка не требует «Найти». */}
          <Listbox
            aria-labelledby={whenLabelId}
            value={when}
            options={[{ value: '', label: 'Любая дата' }, ...WHEN_OPTIONS]}
            onChange={(next) => onSearch({ when: next || undefined })}
            triggerClassName="py-0.5 text-lg outline-none"
          />
        </SearchField>
      </div>
      <Button type="submit" size="lg" className="justify-self-start md:justify-self-stretch">
        <Icon name="search" />
        Найти
      </Button>
    </form>
  );
}

/** Поле поиска: подпись над ним, между полями — пунктир (на телефоне сверху, на широком — слева). */
function SearchField({
  label,
  labelId,
  divider = false,
  children,
}: {
  label: string;
  /** Для списка «Когда»: подпись связана через aria-labelledby, а не обёрткой <label>. */
  labelId?: string;
  divider?: boolean;
  children: ReactNode;
}) {
  const Tag = labelId ? 'div' : 'label';
  return (
    <Tag
      className={[
        // Поле, где сейчас ввод, — подложка и жёлтая полоса снизу, как у активного пункта меню.
        'flex min-w-0 flex-col rounded-md px-3 py-1.5 transition-colors focus-within:bg-surface-muted focus-within:shadow-[inset_0_-3px_0_var(--color-accent)]',
        divider
          ? 'rounded-none border-dashed border-line-soft max-sm:border-t-2 sm:border-l-2'
          : '',
      ].join(' ')}
    >
      <span id={labelId} className="text-sm font-semibold text-ink-muted">
        {label}
      </span>
      {children}
    </Tag>
  );
}

/** Ближайшая запись участника строкой над лентой. Гостю и без записей блока нет. */
function NextRegistration() {
  const me = useMe();
  const mine = useMyRegistrations(me.data?.role === 'user', 1);
  const next = mine.data?.items[0];
  if (!next) return null;
  return (
    <aside
      aria-label="Моя ближайшая запись"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-ink bg-surface px-4 py-3 shadow-sm"
    >
      <span className="text-sm font-semibold text-ink-muted">Ваша ближайшая встреча</span>
      <Link to={`/events/${next.id}`} className="font-semibold">
        {next.title} · {formatShort(next.startsAt)}
      </Link>
      {next.status === 'published' ? (
        <StatusBadge kind="registration" status={next.myRegistration.status} />
      ) : (
        <StatusBadge kind="event" status={next.status} />
      )}
      <Link to="/me/events" className="tap-area ml-auto font-semibold">
        Все мои мероприятия →
      </Link>
    </aside>
  );
}

/** Список «Рядом с вами» и карта той же подборки; «На карте» и клик по метке связывают их. */
function EventsSplit({
  params,
  hasFilters,
  onReset,
  view,
  onView,
  onParam,
}: {
  params: FeedParams;
  hasFilters: boolean;
  onReset: () => void;
  view: View;
  onView: (view: View) => void;
  onParam: (key: string, value: string | undefined) => void;
}) {
  const wide = useWide();
  const [selectedId, setSelectedId] = useState<string>();
  const [focus, setFocus] = useState<MapFocus>();

  const showOnMap = (event: EventListItem) => {
    if (event.lat === null || event.lng === null) return;
    setSelectedId(event.id);
    setFocus({ id: event.id, lat: event.lat, lng: event.lng, key: Date.now() });
    if (!wide) onView('map');
  };
  const selectFromMap = (id: string) => {
    setSelectedId(id);
    document.getElementById(`feed-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return (
    <section aria-label="Встречи" className="flex flex-col gap-5">
      {!wide && (
        // Выбранный вид — жёлтый, как выбранный чип вида спорта.
        <div role="group" aria-label="Как показать встречи" className="flex gap-2">
          <Button variant={view === 'list' ? 'accent' : 'secondary'} onClick={() => onView('list')}>
            Список
          </Button>
          <Button variant={view === 'map' ? 'accent' : 'secondary'} onClick={() => onView('map')}>
            Карта
          </Button>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
        {(wide || view === 'list') && (
          <EventList
            params={params}
            hasFilters={hasFilters}
            onReset={onReset}
            onParam={onParam}
            selectedId={selectedId}
            onShowOnMap={showOnMap}
            onHover={setSelectedId}
          />
        )}
        {(wide || view === 'map') && (
          // Легенда и ссылка на большую карту лежат внутри рамки карты, в нижних углах: под картой
          // строка легенды терялась. Справа снизу остаётся место для подписи «© OpenStreetMap».
          <div className="min-w-0">
            <EventsMap
              filters={params}
              selectedId={selectedId}
              onSelect={selectFromMap}
              focus={focus}
              className="h-[70vh] min-h-[420px] lg:h-[min(780px,calc(100dvh_-_7rem))]"
              overlay={
                // На телефоне кнопка стоит над легендой, на широком экране — в соседнем углу.
                <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <MapLegend />
                  <ButtonLink to="/map" variant="secondary" className="pointer-events-auto sm:mb-4">
                    Большая карта →
                  </ButtonLink>
                </div>
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

// Затухание нижнего края списка, пока ниже есть карточки.
const FADE_BOTTOM = 'linear-gradient(to bottom, #000 calc(100% - 56px), transparent)';

function EventList({
  params,
  hasFilters,
  onReset,
  onParam,
  selectedId,
  onShowOnMap,
  onHover,
}: {
  params: FeedParams;
  hasFilters: boolean;
  onReset: () => void;
  onParam: (key: string, value: string | undefined) => void;
  selectedId: string | undefined;
  onShowOnMap: (event: EventListItem) => void;
  onHover: (id: string) => void;
}) {
  const feed = useFeed(params);
  const activeFilters = [params.joinMode, params.level].filter(Boolean).length;
  // Открыты сами, если фильтр уже выбран (например, пришли по ссылке с ним).
  const [filtersOpen, setFiltersOpen] = useState(activeFilters > 0);
  const filtersId = useId();
  const total = feed.data?.pages[0].total;
  const scroller = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const checkMore = () => {
    const el = scroller.current;
    if (el) setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(checkMore);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Новая страница ленты или другие фильтры меняют высоту содержимого.
  useEffect(checkMore);
  const events = feed.data?.pages.flatMap((page) => page.items) ?? [];

  let body: ReactNode;
  if (feed.isPending) body = <SkeletonList count={3} />;
  else if (feed.isError) body = <ErrorState error={feed.error} onRetry={() => feed.refetch()} />;
  else if (events.length === 0) {
    body = (
      <EmptyState
        title={hasFilters ? 'По этим условиям встреч нет' : 'Пока нет встреч'}
        text={
          hasFilters
            ? 'Попробуйте другую дату, место или вид спорта.'
            : 'Создайте свою — соседи увидят её на карте.'
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
    );
  } else {
    body = (
      <>
        {events.map((event, index) => {
          const day = eventDay(event.startsAt);
          const newDay = index === 0 || eventDay(events[index - 1]!.startsAt) !== day;
          return (
            <div key={event.id} className="flex flex-col gap-3">
              {newDay && <DayHeading day={day} />}
              <FeedItem
                event={event}
                selected={event.id === selectedId}
                onShowOnMap={() => onShowOnMap(event)}
                onHover={() => onHover(event.id)}
              />
            </div>
          );
        })}
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
      </>
    );
  }

  return (
    // На широком экране высоту ряда задаёт карта, а список занимает её же высоту
    // и листается сам, колесом над ним; страница при этом остаётся на месте.
    <div className="relative min-w-0">
      <div className="flex flex-col gap-3 lg:absolute lg:inset-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h3 leading-tight">
              Рядом с вами
              {total !== undefined && (
                <span className="ml-2 font-sans text-sm font-semibold text-ink-muted">
                  {plural(total, ['встреча', 'встречи', 'встреч'])}
                </span>
              )}
            </h2>
            <p className="text-sm text-ink-muted">{LOCAL_TIME_NOTE}</p>
          </div>
          <Button
            variant={filtersOpen ? 'accent' : 'secondary'}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="chevronDown" size={18} className={filtersOpen ? 'rotate-180' : ''} />
            Фильтры{activeFilters > 0 && ` · ${activeFilters}`}
          </Button>
        </div>
        <div id={filtersId} hidden={!filtersOpen} className="grid grid-cols-2 gap-3">
          <SelectField
            label="Режим записи"
            placeholder="Любой"
            options={JOIN_MODES.map((value) => ({ value, label: JOIN_MODE_LABELS[value] }))}
            value={params.joinMode ?? ''}
            onChange={(e) => onParam('mode', e.target.value)}
          />
          <SelectField
            label="Уровень"
            placeholder="Любой"
            options={EVENT_LEVELS.map((value) => ({ value, label: EVENT_LEVEL_LABELS[value] }))}
            value={params.level ?? ''}
            onChange={(e) => onParam('level', e.target.value)}
          />
        </div>
        <div
          ref={scroller}
          aria-busy={feed.isFetching || undefined}
          onScroll={checkMore}
          // Ползунок скрыт; что ниже есть ещё карточки, показывает затухание у нижнего края.
          // Отступ справа и снизу — под жёсткую тень карточек, иначе прокрутка её обрезает.
          className="flex flex-col gap-3.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2.5 lg:pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
          style={moreBelow ? { maskImage: FADE_BOTTOM } : undefined}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

/** Заголовок дня в ленте: «Сегодня», «Завтра», «Сб, 24 окт.» — с чертой, как линия разметки. */
function DayHeading({ day }: { day: string }) {
  return (
    <h3 className="mt-1 flex items-center gap-3 text-lg after:h-[3px] after:flex-1 after:bg-ink">
      {formatDayHeading(day)}
    </h3>
  );
}

/** Места коротко: «2 из 12» при лимите, иначе сколько идёт. */
function seatsShort(event: EventListItem) {
  if (event.capacity !== null) return `${event.participantsCount} из ${event.capacity}`;
  if (event.participantsCount === 0) return 'Пока никого';
  return plural(event.participantsCount, ['участник', 'участника', 'участников']);
}

/**
 * Карточка в списке рядом с картой: полоса в цвете вида спорта со временем, название, место,
 * места и одно действие. Наведение подсвечивает метку на карте; значок «На карте» на телефоне
 * переключает на карту и показывает встречу.
 */
function FeedItem({
  event,
  selected,
  onShowOnMap,
  onHover,
}: {
  event: EventListItem;
  selected: boolean;
  onShowOnMap: () => void;
  onHover: () => void;
}) {
  const onMap = event.lat !== null && event.lng !== null;
  return (
    <article
      id={`feed-${event.id}`}
      onMouseEnter={onHover}
      className={`scroll-m-2 overflow-hidden rounded-lg border-2 border-ink bg-surface ${selected ? 'shadow-md outline-3 outline-offset-1 outline-accent' : 'shadow-sm'}`}
    >
      <div
        className="flex items-center justify-between gap-3 border-b-2 border-ink px-3.5 py-1.5 font-semibold"
        style={{ background: sportColor(event.sport.slug) }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name={sportIcon(event.sport.slug)} size={18} />
          <span className="truncate">{event.sport.name}</span>
        </span>
        <span className="font-display text-[17px] tabular-nums">{formatTime(event.startsAt)}</span>
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <h3 className="font-sans text-[19px] leading-snug font-semibold">
          <Link to={`/events/${event.id}`} className="tap-area no-underline hover:underline">
            {event.title}
          </Link>
        </h3>
        {/* Где и кто собирает — клуб или человек: по нему решают, идти ли, и находят встречи
            клуба. Одной строкой, если помещается: карточка остаётся низкой. */}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="flex items-start gap-1.5">
            <Icon name="pin" size={16} className="mt-0.5" />
            {event.address}
          </span>
          <span className="flex items-start gap-1.5">
            <Icon name="people" size={16} className="mt-0.5" />
            <span>
              Организатор: <span className="font-semibold text-ink">{event.organizer.name}</span>
            </span>
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {event.joinMode === 'request' ? (
              <JoinModeBadge mode="request" />
            ) : (
              <Badge tone="free" icon="people">
                {seatsShort(event)}
              </Badge>
            )}
            {onMap && (
              <Button
                variant="secondary"
                onClick={onShowOnMap}
                aria-label={`${event.title} на карте`}
                className="px-3"
              >
                <Icon name="pin" size={18} />
              </Button>
            )}
          </span>
          <FeedAction event={event} />
        </div>
      </div>
    </article>
  );
}

/**
 * Действие в карточке. Свободная запись — сразу из списка; по заявке — на странице события,
 * где можно написать сообщение. Права всё равно проверяет сервер, ответ показываем под кнопкой.
 */
function FeedAction({ event }: { event: EventListItem }) {
  const me = useMe();
  const navigate = useNavigate();
  const join = useJoinEvent(event.id);
  const href = `/events/${event.id}`;
  const role = me.data?.role;

  if (event.myRegistration) {
    return <StatusBadge kind="registration" status={event.myRegistration.status} />;
  }
  const own = event.organizer.type === 'user' && event.organizer.id === me.data?.id;
  if (own || (role && role !== 'user')) {
    return (
      <ButtonLink to={href} variant="secondary">
        {own ? 'Ваша встреча' : 'Подробнее'}
      </ButtonLink>
    );
  }
  if (event.registrationClosed) {
    return (
      <ButtonLink to={href} variant="secondary" aria-label={`Запись закрыта: ${event.title}`}>
        <Icon name="lock" size={16} />
        Запись закрыта
      </ButtonLink>
    );
  }
  if (event.freeSlots === 0) {
    return (
      <ButtonLink to={href} variant="secondary" aria-label={`Мест нет: ${event.title}`}>
        Мест нет
      </ButtonLink>
    );
  }
  if (event.joinMode === 'request') {
    return (
      // Белая, со стрелкой в сиреневом кружке — в цвет плашки «По заявке» и кнопки на странице
      // встречи: заявку подают там, эта кнопка ведёт к ней.
      <ButtonLink to={href} variant="secondary" className="gap-2.5 pr-1.5">
        Подать заявку
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full border-[1.5px] border-ink bg-status-request"
        >
          <Icon name="arrowRight" size={16} />
        </span>
      </ButtonLink>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        loading={join.isPending}
        onClick={() =>
          me.data ? join.mutate(null) : navigate(`/login?next=${encodeURIComponent(href)}`)
        }
      >
        Записаться
      </Button>
      {join.error && (
        <p role="alert" className="text-sm font-semibold">
          {join.error instanceof ApiError
            ? join.error.message
            : 'Не получилось. Попробуйте ещё раз'}
        </p>
      )}
    </div>
  );
}

const STEPS = [
  {
    color: 'var(--sport-1)',
    title: 'Выберите занятие',
    text: 'Из списка или своё — даже самое редкое.',
  },
  {
    color: 'var(--sport-3)',
    title: 'Найдите на карте',
    text: 'Встречи рядом, условия и организатор — в одном окне.',
  },
  {
    color: 'var(--sport-2)',
    title: 'Присоединяйтесь',
    text: 'Сразу или по заявке — статус всегда в «Моих мероприятиях».',
  },
];

/**
 * «Как это работает»: отдельный раздел — двойной отступ от карты и видимый заголовок.
 * Только гостю: кто вошёл, уже знает, как пользоваться.
 */
function Steps() {
  const me = useMe();
  const headingId = useId();
  if (me.isPending || me.data) return null;
  return (
    <section aria-labelledby={headingId} className="mt-8 flex flex-col gap-5">
      <h2 id={headingId} className="text-h2">
        Как это работает
      </h2>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="flex flex-col gap-2 rounded-lg border-2 border-ink bg-surface p-6"
          >
            <span
              aria-hidden="true"
              className="inline-flex size-12 items-center justify-center rounded-full border-2 border-ink font-display text-[22px] font-bold"
              style={{ background: step.color }}
            >
              {index + 1}
            </span>
            <h3 className="text-h3">{step.title}</h3>
            <p className="text-ink-muted">{step.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** «Клуб или сообщество?» — только гостю: регистрация организации. */
function OrgInvite() {
  const me = useMe();
  if (me.isPending || me.data) return null;
  return (
    <section className="flex flex-wrap items-center justify-between gap-6 rounded-xl border-2 border-ink bg-status-request p-6 shadow-lg md:p-9">
      <div className="min-w-0 flex-[1_1_440px]">
        <h2 className="text-h2 mb-2">Клуб или сообщество?</h2>
        <p className="text-lg">
          Заведите страницу организации. После одобрения администратором ваши встречи сразу появятся
          на карте.
        </p>
      </div>
      <ButtonLink to="/register" variant="secondary" size="lg">
        Подать заявку
      </ButtonLink>
    </section>
  );
}

/** Легенда карты в её левом нижнем углу: те же значки, что на метках. */
function MapLegend() {
  return (
    <ul
      aria-label="Обозначения на карте"
      className="pointer-events-auto flex flex-col gap-1.5 rounded-lg border-2 border-ink bg-surface px-3.5 py-2.5 text-sm shadow-sm"
    >
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="ml-0.5 size-3.5 rotate-[-45deg] rounded-[50%_50%_50%_0] border-2 border-ink bg-[var(--sport-2)]"
        />
        встреча, цвет — вид спорта
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-[18px] items-center justify-center rounded-full bg-ink text-white"
        >
          <Icon name="lock" size={10} strokeWidth={2.8} />
        </span>
        по заявке
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-[18px] items-center justify-center rounded-full border-2 border-ink bg-[conic-gradient(var(--sport-4)_0_50%,var(--sport-3)_0)]"
        >
          <span className="size-2 rounded-full bg-surface" />
        </span>
        несколько встреч рядом
      </li>
    </ul>
  );
}
