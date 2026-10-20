// Создание и правка мероприятия (задачи 1.3, 1.10, сценарии 1 и 2 ТЗ). Одна форма на оба случая.
// Проверка — той же схемой, что на сервере (createEventSchema), поэтому ошибки под полями
// появляются до отправки и теми же словами. Время вводится в поясе устройства. Место выбирается
// на карте «Место встречи» (участник 2): площадка с контактом администратора или своя точка.
import {
  EVENT_LEVEL_LABELS,
  EVENT_LEVELS,
  zodFieldErrors,
  type EventLevel,
  type JoinMode,
} from '@sport/shared';
import {
  createEventSchema,
  EVENT_LIMITS,
  updateEventSchema,
  type EventDetails,
  type EventInput,
} from '@sport/shared/schemas/events';
import { normalizeSportName, sportSlug } from '@sport/shared/schemas/sports';
import { SPORT_THEME_LABELS, sportTheme } from '@sport/shared/sportThemes';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Chip,
  Icon,
  Skeleton,
  SkeletonList,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { useMyOrganization } from '../org/api';
import { AddressField, MapPicker, useVenue, type PlaceValue } from '../org/map';
import { useCreateEvent, useEvent, useSports, useUpdateEvent } from './api';
import { SportTile } from './EventBits';
import { DayPicker, JoinModeCards, SeatsField, SportTiles, TimePicker } from './EventFormParts';
import { localParts, LOCAL_TIME_NOTE, toUtcIso } from './format';

/** Значение списка видов спорта «Другое — впишу сам». */
const CUSTOM_SPORT = 'custom';

type FormState = {
  title: string;
  sportId: string;
  sportName: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  place: PlaceValue;
  address: string;
  placeNotes: string;
  joinMode: JoinMode | '';
  level: EventLevel;
  capacity: string;
  requirements: string;
  chatUrl: string;
};

const EMPTY: FormState = {
  title: '',
  sportId: '',
  sportName: '',
  description: '',
  date: '',
  startTime: '',
  endTime: '',
  place: null,
  address: '',
  placeNotes: '',
  joinMode: '',
  level: 'any',
  capacity: '',
  requirements: '',
  chatUrl: '',
};

function fromEvent(event: EventDetails): FormState {
  const start = localParts(event.startsAt);
  return {
    title: event.title,
    sportId: event.sport.id,
    sportName: '',
    description: event.description,
    date: start.date,
    startTime: start.time,
    endTime: event.endsAt ? localParts(event.endsAt).time : '',
    place: event.venue
      ? { kind: 'venue', venue: event.venue }
      : event.lat !== null && event.lng !== null
        ? { kind: 'point', lat: event.lat, lng: event.lng }
        : null,
    address: event.address,
    placeNotes: event.placeNotes ?? '',
    joinMode: event.joinMode,
    level: event.level,
    capacity: event.capacity === null ? '' : String(event.capacity),
    requirements: event.requirements ?? '',
    chatUrl: event.chatUrl ?? '',
  };
}

/** Поля формы → тело запроса. Пустые необязательные поля уходят как null. */
function toInput(form: FormState): EventInput {
  const custom = form.sportId === CUSTOM_SPORT;
  const point = form.place?.kind === 'point' ? form.place : null;
  return {
    title: form.title,
    description: form.description,
    sportId: custom || !form.sportId ? undefined : form.sportId,
    sportName: custom ? form.sportName : undefined,
    startsAt: toUtcIso(form.date, form.startTime),
    endsAt: form.endTime ? toUtcIso(form.date, form.endTime) : null,
    address: form.address,
    venueId: form.place?.kind === 'venue' ? form.place.venue.id : null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    placeNotes: form.placeNotes,
    joinMode: form.joinMode as JoinMode,
    level: form.level,
    capacity: form.capacity.trim() === '' ? null : Number(form.capacity),
    requirements: form.requirements,
    chatUrl: form.chatUrl.trim() || null,
  };
}

/** Ошибки по полям API → поля формы: время начала показываем под датой, вид спорта — под списком. */
function toFormErrors(fields: Record<string, string>): Record<string, string> {
  const { startsAt, sportName, ...rest } = fields;
  return {
    ...rest,
    ...(startsAt && { date: startsAt }),
    ...(sportName && { sportId: sportName }),
  };
}

export function CreateEventPage() {
  return (
    <RequireAuth roles={['user', 'organization']}>
      <CreateLoader />
    </RequireAuth>
  );
}

/**
 * /events/new?venue=…&sport=… — «Создать встречу здесь» из попапа площадки на карте (участник 2):
 * площадка, её адрес и вид спорта уже выбраны. Площадку не нашли — обычная пустая форма.
 */
function CreateLoader() {
  const [search] = useSearchParams();
  const venue = useVenue(search.get('venue'));
  if (venue.isLoading) return <SkeletonList count={2} />;
  const initial: FormState = {
    ...EMPTY,
    sportId: search.get('sport') ?? '',
    ...(venue.data && {
      place: { kind: 'venue', venue: venue.data },
      address: venue.data.address,
    }),
  };
  return <EventForm initial={initial} />;
}

export function EditEventPage() {
  return (
    <RequireAuth roles={['user', 'organization']}>
      <EditLoader />
    </RequireAuth>
  );
}

function EditLoader() {
  const { id = '' } = useParams();
  const event = useEvent(id);
  if (event.isPending) return <SkeletonList count={2} />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  if (!event.data.permissions.canEdit) {
    return (
      <EmptyState
        icon="lock"
        title="Это событие нельзя изменить"
        text="Править можно только своё опубликованное событие, пока оно не прошло."
        action={<ButtonLink to={`/events/${id}`}>К событию</ButtonLink>}
      />
    );
  }
  return <EventForm initial={fromEvent(event.data)} event={event.data} />;
}

function EventForm({ initial, event }: { initial: FormState; event?: EventDetails }) {
  const navigate = useNavigate();
  const me = useMe();
  const sports = useSports();
  const create = useCreateEvent();
  const update = useUpdateEvent(event?.id ?? '');
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = create.isPending || update.isPending;
  const requestError = create.error ?? update.error;
  const formRef = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);

  // После неудачной отправки — к первому полю с ошибкой: на длинной форме его может быть не видно.
  useEffect(() => {
    if (!attempt) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    // В середину экрана: внизу поле закрыла бы полоса «Опубликовать».
    field?.focus({ preventScroll: true });
    // Группу кнопок (вид спорта, день) — целиком: её ошибка стоит под последней кнопкой.
    (field?.closest('fieldset') ?? field)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [attempt]);

  // Поле формы → под каким полем показана его ошибка (время — под датой, свой вид — под видом спорта).
  const errorKey: Partial<Record<keyof FormState, string>> = {
    startTime: 'date',
    sportName: 'sportId',
    endTime: 'endsAt',
  };

  /** Изменить поле и убрать его старую ошибку: человек её уже исправляет. */
  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const { [errorKey[key] ?? key]: _removed, ...rest } = prev;
        return rest;
      });
    };

  /**
   * Выбрали площадку (на карте или в списке) — в поле её адрес: адрес выбранной метки виден сразу.
   * Своя точка адрес не трогает: его вписали сами или его подставит AddressField по метке;
   * адрес прежней площадки к ней не относится — убираем.
   */
  const choosePlace = (place: PlaceValue) => {
    setForm((prev) => {
      const venueAddress = prev.place?.kind === 'venue' ? prev.place.venue.address : null;
      const address =
        place?.kind === 'venue'
          ? place.venue.address
          : prev.address === venueAddress
            ? ''
            : prev.address;
      return { ...prev, place, address };
    });
    setErrors(({ venueId: _venue, lat: _lat, address: _address, ...rest }) => rest);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = toInput(form);
    const parsed = (event ? updateEventSchema : createEventSchema).safeParse(input);
    const clientErrors = parsed.success ? {} : toFormErrors(zodFieldErrors(parsed.error));
    // Перекрёстные проверки схемы Zod не запускает, пока есть ошибки полей: дублируем главные.
    if (!form.date || !form.startTime) clientErrors.date = 'Укажите дату и время начала';
    if (!form.sportId) clientErrors.sportId = 'Выберите вид спорта из списка или впишите свой';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setAttempt((n) => n + 1);
      return;
    }
    const options = {
      onSuccess: (saved: EventDetails) => navigate(`/events/${saved.id}`),
      onError: (error: Error) => {
        if (error instanceof ApiError) setErrors(toFormErrors(error.fields));
        setAttempt((n) => n + 1);
      },
    };
    if (event) update.mutate(input, options);
    else create.mutate(input, options);
  };

  // Подсказка к «своему» виду спорта: такой уже есть в каталоге — выберем его, дубля не будет.
  const customSlug = form.sportId === CUSTOM_SPORT ? sportSlug(form.sportName) : '';
  const existing = customSlug ? sports.data?.find((sport) => sport.slug === customSlug) : undefined;
  // Новый вид спорта получает иконку по теме названия (участник 2): показываем её сразу.
  const customTheme = customSlug && !existing ? sportTheme(customSlug) : null;
  // Временная метка на карте — как её увидят после публикации (участник 2): вид спорта,
  // режим записи и название из формы.
  const draftSlug =
    form.sportId === CUSTOM_SPORT
      ? customSlug || null
      : (sports.data?.find((sport) => sport.id === form.sportId)?.slug ?? null);

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={event ? `/events/${event.id}` : '/'}
          className="tap-area self-start font-semibold"
        >
          ← {event ? 'К событию' : 'Все встречи'}
        </Link>
        <h1 className="text-h2">{event ? 'Изменить встречу' : 'Новая встреча'}</h1>
        <p className="text-ink-muted">
          {event
            ? 'Участники увидят изменения сразу.'
            : 'Займёт пару минут: почти всё выбирается кнопками.'}
        </p>
      </div>

      {me.data?.role === 'organization' && !event && <PublishAs />}

      {requestError && (
        <Alert>
          {requestError instanceof ApiError
            ? requestError.message
            : 'Не удалось сохранить. Попробуйте ещё раз'}
        </Alert>
      )}
      {!requestError && Object.keys(errors).length > 0 && (
        <Alert>Проверьте поля, отмеченные ниже</Alert>
      )}

      {/*
        На широком экране две колонки: слева что и когда, справа место с крупной картой и запись.
        На узком колонки «растворяются» (contents), и блоки идут по порядку заполнения.
      */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-6 max-lg:contents">
          <Section title="Чем займёмся?" className="max-lg:order-1">
            {sports.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <SportTiles
                sports={sports.data ?? []}
                value={form.sportId}
                customValue={CUSTOM_SPORT}
                onChange={set('sportId')}
                error={form.sportId === CUSTOM_SPORT ? undefined : errors.sportId}
              />
            )}
            {form.sportId === CUSTOM_SPORT && (
              <div className="flex flex-col gap-3">
                <TextField
                  label="Свой вид спорта"
                  placeholder="Например: Скандинавская ходьба"
                  hint={
                    existing
                      ? `«${existing.name}» уже есть в списке — встреча попадёт туда`
                      : form.sportName.trim()
                        ? `Добавим в каталог как «${normalizeSportName(form.sportName)}»`
                        : 'Новый вид спорта сразу появится в поиске и фильтрах'
                  }
                  value={form.sportName}
                  onChange={(e) => set('sportName')(e.target.value)}
                  error={errors.sportId}
                />
                {customSlug && !existing && (
                  <p aria-live="polite" className="flex items-center gap-3 text-sm text-ink-muted">
                    <SportTile sport={{ slug: customSlug }} size={44} />
                    {customTheme
                      ? `Значок подобрали по названию: ${SPORT_THEME_LABELS[customTheme]}`
                      : 'Тему по названию не узнали — будет общий значок'}
                  </p>
                )}
              </div>
            )}
            <TextField
              label="Название"
              placeholder="Например: Утренняя пробежка по острову"
              maxLength={EVENT_LIMITS.title.max}
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              error={errors.title}
            />
            <TextareaField
              label="Что будет на встрече"
              hint="Что будете делать, в каком темпе, кому подойдёт"
              rows={4}
              maxLength={EVENT_LIMITS.description.max}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              error={errors.description}
            />
          </Section>

          <Section title="Когда?" note={LOCAL_TIME_NOTE} className="max-lg:order-2">
            <DayPicker value={form.date} onChange={set('date')} error={errors.date} />
            <TimePicker value={form.startTime} onChange={set('startTime')} />
            <TextField
              label="Окончание"
              hint="Необязательно"
              type="time"
              className="max-w-xs"
              value={form.endTime}
              onChange={(e) => set('endTime')(e.target.value)}
              error={errors.endsAt}
            />
          </Section>

          <Section title="Что ещё знать участникам" note="Необязательно" className="max-lg:order-5">
            <TextareaField
              label="Условия участия"
              hint="Что взять, какая нужна подготовка, есть ли инвентарь"
              rows={3}
              maxLength={EVENT_LIMITS.requirements.max}
              value={form.requirements}
              onChange={(e) => set('requirements')(e.target.value)}
              error={errors.requirements}
            />
            <TextField
              label="Ссылка на чат участников"
              hint="Увидят только подтверждённые участники"
              type="url"
              placeholder="https://t.me/…"
              value={form.chatUrl}
              onChange={(e) => set('chatUrl')(e.target.value)}
              error={errors.chatUrl}
            />
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-6 max-lg:contents">
          <Section title="Где?" className="max-lg:order-3">
            {/* Адрес над картой: вписали — он появляется точкой с подписью на карте ниже (участник 2). */}
            <AddressField
              hint={
                form.place?.kind === 'venue'
                  ? 'Подставлен адрес площадки, можно уточнить'
                  : 'Улица и дом или название места — покажем его на карте'
              }
              maxLength={EVENT_LIMITS.address.max}
              value={form.address}
              onChange={set('address')}
              place={form.place}
              onPlace={choosePlace}
              error={errors.address}
            />
            <MapPicker
              sportId={form.sportId && form.sportId !== CUSTOM_SPORT ? form.sportId : undefined}
              value={form.place}
              onChange={choosePlace}
              address={form.address}
              draft={{ sportSlug: draftSlug, joinMode: form.joinMode, title: form.title }}
              error={errors.venueId ?? errors.lat}
            />
            <TextField
              label="Как найти"
              hint="Необязательно: вход, этаж, ориентир"
              placeholder="У информационного стенда"
              maxLength={EVENT_LIMITS.placeNotes.max}
              value={form.placeNotes}
              onChange={(e) => set('placeNotes')(e.target.value)}
              error={errors.placeNotes}
            />
          </Section>

          <Section title="Как записываться?" className="max-lg:order-4">
            <JoinModeCards
              value={form.joinMode}
              onChange={set('joinMode')}
              error={errors.joinMode}
            />
            <div className="flex flex-wrap gap-x-10 gap-y-5">
              <SeatsField
                value={form.capacity}
                onChange={set('capacity')}
                error={errors.capacity}
              />
              <fieldset className="flex min-w-0 flex-col">
                <legend className="mb-2.5 font-semibold">Уровень подготовки</legend>
                <div className="flex flex-wrap gap-2.5">
                  {EVENT_LEVELS.map((level, index) => (
                    <Chip
                      key={level}
                      index={index}
                      pressed={form.level === level}
                      onClick={() => set('level')(level)}
                    >
                      {EVENT_LEVEL_LABELS[level]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
          </Section>
        </div>
      </div>

      {/* На широком экране полоса прилипает к низу: кнопка видна, где бы человек ни был. На телефоне
          она закрыла бы четверть экрана, поэтому стоит в конце формы. Полоса белая с жёлтой линией
          сверху, с заголовком и крупной кнопкой-таблеткой: главное действие формы видно сразу.
          На невысоком экране (ноутбук до 900px) полоса тоньше — без пояснения и с меньшими
          отступами, — иначе она закрывала низ карты места. */}
      <div className="flex flex-wrap items-center justify-between gap-x-7 gap-y-4 rounded-xl border-2 border-t-[10px] border-ink border-t-accent bg-surface px-5 py-[22px] sm:pr-[26px] sm:pl-8 text-ink shadow-lg lg:sticky lg:bottom-[calc(var(--tabbar-height,0px)+16px)] lg:z-[1100] lg:[@media(max-height:900px)]:py-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <p className="font-display text-[26px] leading-tight font-bold lg:[@media(max-height:900px)]:text-[22px]">
            {event ? 'Готово? Сохраняем' : 'Готово? Публикуем'}
          </p>
          <p className="text-[18px] text-ink-muted lg:[@media(max-height:900px)]:hidden">
            {event
              ? 'Участники увидят изменения сразу после сохранения.'
              : 'Встреча появится в ленте и на карте сразу после публикации.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3.5 max-sm:w-full max-sm:flex-col-reverse max-sm:items-stretch">
          <Link
            to={event ? `/events/${event.id}` : '/'}
            className="inline-flex min-h-12 items-center justify-center px-1.5 font-semibold underline underline-offset-[5px]"
          >
            Отмена
          </Link>
          <Button
            type="submit"
            variant="accent"
            size="xl"
            loading={saving}
            className="max-sm:w-full"
          >
            {saving ? 'Сохраняем…' : event ? 'Сохранить изменения' : 'Опубликовать встречу'}
            <Icon name="arrowRight" size={22} />
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Аккаунт организации публикует от её имени и только после допуска (сценарий 2 ТЗ). */
function PublishAs() {
  const org = useMyOrganization();
  if (org.isPending) return <Skeleton className="h-16 w-full" />;
  if (!org.data) {
    return (
      <Alert tone="warning">
        Публиковать события можно после допуска организации. <Link to="/org">Подать заявку</Link>
      </Alert>
    );
  }
  if (org.data.status !== 'approved') {
    return (
      <Alert tone="warning">
        {org.data.status === 'pending'
          ? 'Заявка организации на рассмотрении: опубликовать событие можно после допуска.'
          : 'Заявка организации отклонена: исправьте данные и подайте её заново.'}{' '}
        <Link to="/org">Кабинет организации</Link>
      </Alert>
    );
  }
  return (
    <Card tone="accent" className="p-4 font-semibold">
      Встреча будет опубликована от имени организации «{org.data.name}», сразу и без повторной
      проверки.
    </Card>
  );
}

/** Блок формы: заголовок-вопрос и, справа, короткая пометка. */
function Section({
  title,
  note,
  className = '',
  children,
}: {
  title: string;
  note?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`flex min-w-0 flex-col gap-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {note && <span className="text-sm text-ink-muted">{note}</span>}
      </div>
      {children}
    </Card>
  );
}
