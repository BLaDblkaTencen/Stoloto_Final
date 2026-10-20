// Главная (задачи 1.4, 1.10) по макету docs/design/home.html: поиск «Чем заняться / Где / Когда»,
// стикеры «Мои записи», чипы видов спорта, список встреч рядом с картой, «Как это работает».
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
  Button,
  ButtonLink,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  JoinModeBadge,
  Listbox,
  SelectField,
  SkeletonList,
  SportChip,
  StatusBadge,
} from '../../shared/ui';
import { useMe } from '../auth/api';
import { EventsMap, type MapFocus } from '../org/map';
import { useFeed, useJoinEvent, useMyRegistrations, useSports, type FeedParams } from './api';
import { MetaLine, SportTile } from './EventBits';
import { formatSeats, formatShort, formatWhen, isoDay, LOCAL_TIME_NOTE, plural } from './format';

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

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <h1 className="text-h1-mobile leading-tight md:text-h1">
            Больше, чем спорт —{' '}
            <span className="rounded-[14px] bg-accent px-3 box-decoration-clone">это люди</span>
          </h1>
          <p className="max-w-[620px] text-lg text-ink-muted">
            Смотрите, кто и где собирается рядом с вами, и присоединяйтесь. Не нашли своё —{' '}
            {me.data?.role === 'admin' ? (
              'создайте встречу сами.'
            ) : (
              <>
                <Link to="/events/new">создайте встречу сами</Link>.
              </>
            )}
          </p>
          <SearchForm
            key={`${params.q ?? ''}|${params.place ?? ''}`}
            q={params.q ?? ''}
            place={params.place ?? ''}
            when={when}
            onSearch={setParams}
          />
        </div>
        <MyRegistrations />
      </section>

      <SportFilter
        sportId={params.sportId}
        onChange={(id) => setParams({ sport: id })}
        canCreate={me.data?.role !== 'admin'}
      />

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
      className="flex max-w-[760px] flex-col gap-2.5 rounded-[22px] border-2 border-ink bg-surface p-2.5 shadow-md"
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
      <Button type="submit" size="lg" className="self-start">
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

/** Стикер «Мои записи»: чуть повёрнут, как в макете; соседние — в разные стороны. */
function Sticker({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border-2 border-ink bg-surface px-[18px] py-4 shadow-md"
      style={{ rotate: index % 2 ? '1deg' : '-1.5deg' }}
    >
      {children}
    </div>
  );
}

const StickerCaption = () => (
  <span className="text-sm font-semibold text-ink-muted">Мои записи</span>
);

/** Ближайшие записи участника: статус видно сразу на главной. Гостю — приглашение войти. */
function MyRegistrations() {
  const me = useMe();
  const isParticipant = me.data?.role === 'user';
  const mine = useMyRegistrations(isParticipant, 2);

  let stickers: ReactNode = null;
  if (!me.isPending && !me.data) {
    stickers = (
      <Sticker index={0}>
        <StickerCaption />
        <p>Войдите, и здесь появятся встречи, куда вы записаны, и ответы на заявки.</p>
        <Link to="/login" className="self-start font-semibold">
          Войти
        </Link>
      </Sticker>
    );
  } else if (isParticipant && mine.data) {
    stickers =
      mine.data.items.length === 0 ? (
        <Sticker index={0}>
          <StickerCaption />
          <p>Вы пока никуда не записаны. Выберите встречу ниже.</p>
        </Sticker>
      ) : (
        <>
          {mine.data.items.map((item, index) => (
            <Sticker key={item.id} index={index}>
              {index === 0 && <StickerCaption />}
              <div className="flex flex-wrap items-center justify-between gap-2.5 font-semibold">
                <Link to={`/events/${item.id}`} className="min-w-0 no-underline hover:underline">
                  {item.title} · {formatShort(item.startsAt)}
                </Link>
                {item.status === 'published' ? (
                  <StatusBadge kind="registration" status={item.myRegistration.status} />
                ) : (
                  <StatusBadge kind="event" status={item.status} />
                )}
              </div>
            </Sticker>
          ))}
          <Link to="/me/events" className="self-end font-semibold">
            Все мои мероприятия →
          </Link>
        </>
      );
  }
  if (!stickers) return null;
  return (
    <aside aria-label="Мои записи" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
      {stickers}
    </aside>
  );
}

/** Чипы видов спорта с ближайшими встречами и «Своё направление» — создать встречу с новым видом. */
function SportFilter({
  sportId,
  onChange,
  canCreate,
}: {
  sportId: string | undefined;
  onChange: (id: string | undefined) => void;
  canCreate: boolean;
}) {
  const sports = useSports({ withEvents: true });
  if (!sports.data) return null;
  return (
    <section
      aria-label="Виды спорта"
      // На телефоне — одна строка с прокруткой: столбик чипов занимал бы пол-экрана.
      className="-mx-6 flex gap-3 overflow-x-auto px-6 pt-1 pb-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0"
    >
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
      {canCreate && (
        <Link
          to="/events/new?sport=custom"
          aria-label="Своё направление: создать встречу с новым видом спорта"
          className="inline-flex min-h-[var(--control-height)] items-center gap-2 rounded-md border-2 border-ink bg-surface pr-[18px] pl-[7px] text-sm font-semibold no-underline transition-[translate] duration-100 hover:-translate-y-px hover:text-ink"
        >
          <span className="inline-flex size-[34px] items-center justify-center rounded-[11px] border-2 border-ink bg-surface">
            <Icon name="plus" size={19} />
          </span>
          Своё направление
        </Link>
      )}
    </section>
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
          />
        )}
        {(wide || view === 'map') && (
          <div className="flex min-w-0 flex-col gap-2">
            <EventsMap
              filters={params}
              selectedId={selectedId}
              onSelect={selectFromMap}
              focus={focus}
              className="h-[70vh] min-h-[420px] lg:h-[min(780px,calc(100dvh_-_7rem))]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex flex-wrap items-center gap-3 font-semibold">
                Цвет — вид спорта
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-ink text-white">
                    <Icon name="lock" size={12} strokeWidth={2.6} />
                  </span>
                  по заявке
                </span>
              </span>
              <Link to="/map" className="font-semibold">
                Большая карта с площадками →
              </Link>
            </div>
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
}: {
  params: FeedParams;
  hasFilters: boolean;
  onReset: () => void;
  onParam: (key: string, value: string | undefined) => void;
  selectedId: string | undefined;
  onShowOnMap: (event: EventListItem) => void;
}) {
  const feed = useFeed(params);
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
        {events.map((event) => (
          <FeedItem
            key={event.id}
            event={event}
            selected={event.id === selectedId}
            onShowOnMap={() => onShowOnMap(event)}
          />
        ))}
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[26px] leading-tight font-bold">Рядом с вами</h2>
          {total !== undefined && (
            <span className="text-sm text-ink-muted">
              {plural(total, ['встреча', 'встречи', 'встреч'])}
            </span>
          )}
        </div>
        <p className="text-sm text-ink-muted">{LOCAL_TIME_NOTE}</p>
        <div className="grid grid-cols-2 gap-3">
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

/** Карточка в списке рядом с картой: вид спорта, режим, что, когда, где, места, «На карте» и действие. */
function FeedItem({
  event,
  selected,
  onShowOnMap,
}: {
  event: EventListItem;
  selected: boolean;
  onShowOnMap: () => void;
}) {
  const href = `/events/${event.id}`;
  const onMap = event.lat !== null && event.lng !== null;
  return (
    <article
      id={`feed-${event.id}`}
      className={`flex scroll-m-2 gap-3.5 rounded-lg border-2 border-ink p-3.5 ${selected ? 'bg-accent shadow-md' : 'bg-surface shadow-sm'}`}
    >
      {/* Содержание — как в карточке профиля: вид спорта и режим, название, когда, где, места. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold">
            <SportTile sport={event.sport} size={32} />
            {event.sport.name}
          </span>
          <JoinModeBadge mode={event.joinMode} />
        </div>
        <h3 className="mt-1 text-[19px] leading-snug">
          <Link to={href} className="no-underline hover:underline">
            {event.title}
          </Link>
        </h3>
        <MetaLine icon="calendar">{formatWhen(event.startsAt, event.endsAt)}</MetaLine>
        <MetaLine icon="pin">{event.address}</MetaLine>
        <MetaLine icon="people">{formatSeats(event.participantsCount, event.capacity)}</MetaLine>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {onMap ? (
            <Button
              variant="secondary"
              onClick={onShowOnMap}
              aria-label={`${event.title} на карте`}
            >
              <Icon name="pin" size={16} />
              На карте
            </Button>
          ) : (
            <span />
          )}
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

function Steps() {
  return (
    <section
      aria-label="Как это работает"
      className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"
    >
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
    </section>
  );
}

/** «Клуб или сообщество?» — гостю регистрация организации, организации — её кабинет. */
function OrgInvite() {
  const me = useMe();
  const role = me.data?.role;
  if (me.isPending || (role && role !== 'organization')) return null;
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-xl border-2 border-ink bg-status-request p-6 shadow-lg md:p-9">
      <div className="min-w-0 flex-[1_1_440px]">
        <h2 className="text-h2 mb-2">Клуб или сообщество?</h2>
        <p className="text-lg">
          Заведите страницу организации. После одобрения администратором ваши встречи сразу появятся
          на карте.
        </p>
      </div>
      <ButtonLink to={role ? '/org' : '/register'} variant="secondary" size="lg">
        {role ? 'Кабинет организации' : 'Подать заявку'}
      </ButtonLink>
    </section>
  );
}
