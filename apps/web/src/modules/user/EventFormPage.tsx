// Создание и правка мероприятия (задачи 1.3, 1.10, сценарии 1 и 2 ТЗ). Место выбирается на карте
// «Место встречи» участника 2: площадка с контактом администратора или своя точка (двор, парк).
// Проверки — те же Zod-схемы, что на сервере; правила вроде «нельзя сменить режим записи, когда
// уже есть записи» проверяет сервер, форма показывает его ответ.
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
import { sportSlug } from '@sport/shared/schemas/sports';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  RadioCards,
  SelectField,
  Skeleton,
  SkeletonList,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { useMyOrganization } from '../org/api';
import { formErrors } from '../org/errors';
import { MapPicker, type PlaceValue } from '../org/map';
import { useEvent, useSaveEvent, useSports } from './api';
import { isoDay, isoToZoned, LOCAL_TIME_NOTE, zonedToIso } from './format';

const OTHER_SPORT = 'other';

const JOIN_MODE_OPTIONS = [
  {
    value: 'free',
    title: 'Свободная запись',
    text: 'Человек нажимает «Записаться» и сразу попадает в список участников',
  },
  {
    value: 'request',
    title: 'По заявке',
    text: 'Человек отправляет заявку, вы принимаете или отклоняете её',
  },
] as const;

type FormState = {
  title: string;
  sport: string;
  sportName: string;
  day: string;
  time: string;
  endTime: string;
  place: PlaceValue;
  address: string;
  placeNotes: string;
  description: string;
  requirements: string;
  joinMode: JoinMode | '';
  level: EventLevel;
  capacity: string;
  chatUrl: string;
};

function initialState(event?: EventDetails): FormState {
  if (!event) {
    return {
      title: '',
      sport: '',
      sportName: '',
      day: isoDay(1),
      time: '10:00',
      endTime: '',
      place: null,
      address: '',
      placeNotes: '',
      description: '',
      requirements: '',
      joinMode: '',
      level: 'any',
      capacity: '',
      chatUrl: '',
    };
  }
  const start = isoToZoned(event.startsAt);
  return {
    title: event.title,
    sport: event.sport.id,
    sportName: '',
    day: start.day,
    time: start.time,
    endTime: event.endsAt ? isoToZoned(event.endsAt).time : '',
    place: event.venue
      ? { kind: 'venue', venue: event.venue }
      : event.lat !== null && event.lng !== null
        ? { kind: 'point', lat: event.lat, lng: event.lng }
        : null,
    address: event.address,
    placeNotes: event.placeNotes ?? '',
    description: event.description,
    requirements: event.requirements ?? '',
    joinMode: event.joinMode,
    level: event.level,
    capacity: event.capacity === null ? '' : String(event.capacity),
    chatUrl: event.chatUrl ?? '',
  };
}

/** Тело запроса из полей формы. Окончание раньше начала — значит, встреча заканчивается после полуночи. */
function toBody(form: FormState): Partial<EventInput> {
  const startsAt = form.day && form.time ? zonedToIso(form.day, form.time) : '';
  let endsAt: string | null = null;
  if (startsAt && form.endTime) {
    endsAt = zonedToIso(form.day, form.endTime);
    if (endsAt <= startsAt) {
      endsAt = new Date(new Date(endsAt).getTime() + 86_400_000).toISOString();
    }
  }
  const point = form.place?.kind === 'point' ? form.place : null;
  const capacity = form.capacity.trim();
  return {
    title: form.title,
    ...(form.sport === OTHER_SPORT
      ? { sportName: form.sportName }
      : { sportId: form.sport || undefined }),
    startsAt,
    endsAt,
    address: form.address.trim() || undefined,
    venueId: form.place?.kind === 'venue' ? form.place.venue.id : null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    placeNotes: form.placeNotes,
    description: form.description,
    requirements: form.requirements,
    joinMode: form.joinMode || undefined,
    level: form.level,
    capacity: capacity === '' ? null : Number(capacity),
    chatUrl: form.chatUrl.trim(),
  } as Partial<EventInput>;
}

export function CreateEventRoute() {
  return (
    <RequireAuth roles={['user', 'organization']}>
      <EventFormScreen />
    </RequireAuth>
  );
}

export function EditEventRoute() {
  return (
    <RequireAuth roles={['user', 'organization']}>
      <EditEventScreen />
    </RequireAuth>
  );
}

function EditEventScreen() {
  const { id = '' } = useParams();
  const event = useEvent(id);
  if (event.isPending) return <SkeletonList count={3} />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;
  if (!event.data.permissions.canEdit) {
    return (
      <EmptyState
        icon="lock"
        title="Это событие нельзя изменить"
        text="Править может только организатор, и только пока событие опубликовано и не прошло."
        action={<ButtonLink to={`/events/${id}`}>К событию</ButtonLink>}
      />
    );
  }
  return <EventFormScreen event={event.data} />;
}

function EventFormScreen({ event }: { event?: EventDetails }) {
  const navigate = useNavigate();
  const me = useMe();
  const isOrganization = me.data?.role === 'organization';
  const save = useSaveEvent(event?.id);
  const [form, setForm] = useState(() => initialState(event));
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const server = formErrors(save.error, 'Не получилось сохранить. Попробуйте ещё раз');
  const fields = Object.keys(clientFields).length > 0 ? clientFields : server.fields;
  const formRef = useRef<HTMLFormElement>(null);

  // После неудачной отправки — к первому полю с ошибкой: на длинной форме его не видно.
  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [clientFields, save.error]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const choosePlace = (place: PlaceValue) =>
    setForm((current) => {
      const previous = current.place?.kind === 'venue' ? current.place.venue.address : '';
      // Адрес площадки подставляем, пока человек не вписал свой.
      const keepAddress = current.address.trim() !== '' && current.address !== previous;
      const address =
        place?.kind === 'venue' && !keepAddress
          ? place.venue.address
          : keepAddress
            ? current.address
            : '';
      return { ...current, place, address };
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = toBody(form);
    const schema = event ? updateEventSchema : createEventSchema;
    const parsed = schema.safeParse(body);
    const errors = parsed.success ? {} : zodFieldErrors(parsed.error);
    if (!errors.startsAt && body.startsAt && new Date(body.startsAt).getTime() <= Date.now()) {
      errors.startsAt = 'Начало должно быть в будущем';
    }
    setClientFields(errors);
    if (Object.keys(errors).length > 0) return;
    save.mutate(body, { onSuccess: (saved) => navigate(`/events/${saved.id}`) });
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link to={event ? `/events/${event.id}` : '/'} className="self-start font-semibold">
        ← {event ? 'К событию' : 'Все встречи'}
      </Link>
      <div>
        <h1 className="text-h2 mb-2">{event ? 'Изменить встречу' : 'Новая встреча'}</h1>
        <p className="text-ink-muted">
          {event
            ? 'Участники увидят изменения сразу. Режим записи и лимит мест нельзя поменять так, чтобы записавшиеся потеряли место.'
            : 'Встреча появится в ленте сразу после публикации.'}
        </p>
      </div>

      {isOrganization && !event && <PublishAs />}

      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Section title="Что">
          <TextField
            label="Название"
            hint="Например «Утренняя пробежка по набережной»"
            maxLength={EVENT_LIMITS.title.max}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            error={fields.title}
          />
          <SportField
            sport={form.sport}
            sportName={form.sportName}
            onSport={(value) => set('sport', value)}
            onSportName={(value) => set('sportName', value)}
            error={fields.sportId ?? fields.sportName}
          />
          <TextareaField
            label="Что будет на встрече"
            hint="Формат, продолжительность, для кого"
            rows={5}
            maxLength={EVENT_LIMITS.description.max}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            error={fields.description}
          />
        </Section>

        <Section title="Когда" note={LOCAL_TIME_NOTE}>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Дата"
              type="date"
              min={isoDay(0)}
              value={form.day}
              onChange={(e) => set('day', e.target.value)}
              error={fields.startsAt}
            />
            <TextField
              label="Начало"
              type="time"
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
            />
            <TextField
              label="Окончание"
              type="time"
              hint="Необязательно"
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
              error={fields.endsAt}
            />
          </div>
        </Section>

        <Section title="Где">
          <MapPicker
            sportId={form.sport && form.sport !== OTHER_SPORT ? form.sport : undefined}
            value={form.place}
            onChange={choosePlace}
            error={fields.venueId ?? fields.lat}
          />
          <TextField
            label="Адрес"
            hint={
              form.place?.kind === 'venue'
                ? 'Подставлен адрес площадки, можно уточнить'
                : 'Улица и дом или понятный ориентир'
            }
            maxLength={EVENT_LIMITS.address.max}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            error={fields.address}
          />
          <TextField
            label="Как найти"
            hint="Необязательно: вход, этаж, у какого фонтана"
            maxLength={EVENT_LIMITS.placeNotes.max}
            value={form.placeNotes}
            onChange={(e) => set('placeNotes', e.target.value)}
            error={fields.placeNotes}
          />
        </Section>

        <Section title="Запись и условия">
          <RadioCards
            legend="Режим записи"
            options={JOIN_MODE_OPTIONS}
            value={form.joinMode}
            onChange={(value) => set('joinMode', value)}
            error={fields.joinMode}
            inline
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Уровень подготовки"
              options={EVENT_LEVELS.map((value) => ({ value, label: EVENT_LEVEL_LABELS[value] }))}
              value={form.level}
              onChange={(e) => set('level', e.target.value as EventLevel)}
              error={fields.level}
            />
            <TextField
              label="Лимит мест"
              type="number"
              inputMode="numeric"
              min={EVENT_LIMITS.capacity.min}
              max={EVENT_LIMITS.capacity.max}
              hint="Пусто — без ограничения"
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
              error={fields.capacity}
            />
          </div>
          <TextareaField
            label="Что взять и как подготовиться"
            hint="Необязательно: инвентарь, форма, взнос за аренду"
            rows={3}
            maxLength={EVENT_LIMITS.requirements.max}
            value={form.requirements}
            onChange={(e) => set('requirements', e.target.value)}
            error={fields.requirements}
          />
          <TextField
            label="Ссылка на чат участников"
            type="url"
            hint="Необязательно. Её увидят только подтверждённые участники"
            placeholder="https://"
            value={form.chatUrl}
            onChange={(e) => set('chatUrl', e.target.value)}
            error={fields.chatUrl}
          />
        </Section>

        {server.message && <Alert>{server.message}</Alert>}
        {Object.keys(fields).length > 0 && (
          <Alert tone="warning">Проверьте поля, отмеченные красным.</Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={save.isPending}>
            {event ? 'Сохранить изменения' : 'Опубликовать встречу'}
          </Button>
          <ButtonLink to={event ? `/events/${event.id}` : '/'} variant="secondary" size="lg">
            Отмена
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3">{title}</h2>
        {note && <span className="text-sm text-ink-muted">{note}</span>}
      </div>
      {children}
    </Card>
  );
}

/** Вид спорта из списка или свой вариант; свой с тем же написанием, что в списке, — подсказка. */
function SportField({
  sport,
  sportName,
  onSport,
  onSportName,
  error,
}: {
  sport: string;
  sportName: string;
  onSport: (value: string) => void;
  onSportName: (value: string) => void;
  error?: string;
}) {
  const sports = useSports();
  if (sports.isPending) return <Skeleton className="h-20 w-full" />;
  const items = sports.data ?? [];
  const slug = sportSlug(sportName);
  const existing = slug ? items.find((item) => sportSlug(item.name) === slug) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Вид спорта"
        placeholder="Выберите из списка"
        options={[
          ...items.map((item) => ({ value: item.id, label: item.name })),
          { value: OTHER_SPORT, label: 'Другой — впишу сам' },
        ]}
        value={sport}
        onChange={(e) => onSport(e.target.value)}
        error={sport === OTHER_SPORT ? undefined : error}
      />
      {sport === OTHER_SPORT && (
        <div className="flex flex-col gap-2">
          <TextField
            label="Свой вид спорта"
            hint="Например «Скандинавская ходьба». Он появится в списке для всех"
            value={sportName}
            onChange={(e) => onSportName(e.target.value)}
            error={error}
          />
          {existing && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              «{existing.name}» уже есть в списке.
              <Button variant="secondary" onClick={() => onSport(existing.id)}>
                Выбрать «{existing.name}»
              </Button>
            </p>
          )}
        </div>
      )}
    </div>
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
      Встреча будет опубликована от имени организации «{org.data.name}».
    </Card>
  );
}
