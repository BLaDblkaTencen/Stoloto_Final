// Создание и правка мероприятия (задача 1.3, сценарий 1 ТЗ). Одна форма на оба случая.
// Проверка — той же схемой, что на сервере (createEventSchema), поэтому ошибки под полями
// появляются до отправки и теми же словами. Время вводится по Красноярску.
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
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  RadioCards,
  SelectField,
  SkeletonList,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { useCreateEvent, useEvent, useSports, useUpdateEvent } from './api';
import { isoDay, localParts, LOCAL_TIME_NOTE, toUtcIso } from './format';

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
  return {
    title: form.title,
    description: form.description,
    sportId: custom || !form.sportId ? undefined : form.sportId,
    sportName: custom ? form.sportName : undefined,
    startsAt: toUtcIso(form.date, form.startTime),
    endsAt: form.endTime ? toUtcIso(form.date, form.endTime) : null,
    address: form.address,
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
      <EventForm initial={EMPTY} />
    </RequireAuth>
  );
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const options = {
      onSuccess: (saved: EventDetails) => navigate(`/events/${saved.id}`),
      onError: (error: Error) => {
        if (error instanceof ApiError) setErrors(toFormErrors(error.fields));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    };
    if (event) update.mutate(input, options);
    else create.mutate(input, options);
  };

  // Подсказка к «своему» виду спорта: такой уже есть в каталоге — выберем его, дубля не будет.
  const customSlug = form.sportId === CUSTOM_SPORT ? sportSlug(form.sportName) : '';
  const existing = customSlug ? sports.data?.find((sport) => sport.slug === customSlug) : undefined;

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to={event ? `/events/${event.id}` : '/'} className="self-start font-semibold">
          ← {event ? 'К событию' : 'Все встречи'}
        </Link>
        <h1 className="text-h2">{event ? 'Изменить встречу' : 'Новая встреча'}</h1>
        {me.data?.role === 'organization' && !event && (
          <p className="text-ink-muted">
            Встреча будет опубликована от имени вашей организации, сразу и без повторной проверки.
          </p>
        )}
      </div>

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

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Что за встреча</h2>
        <TextField
          label="Название"
          placeholder="Например: Утренняя пробежка по острову"
          maxLength={EVENT_LIMITS.title.max}
          value={form.title}
          onChange={(e) => set('title')(e.target.value)}
          error={errors.title}
        />
        <SelectField
          label="Вид спорта"
          placeholder={sports.isPending ? 'Загружаем список…' : 'Выберите вид спорта'}
          options={[
            ...(sports.data ?? []).map((sport) => ({ value: sport.id, label: sport.name })),
            { value: CUSTOM_SPORT, label: 'Другое — впишу сам' },
          ]}
          value={form.sportId}
          onChange={(e) => set('sportId')(e.target.value)}
          error={form.sportId === CUSTOM_SPORT ? undefined : errors.sportId}
        />
        {form.sportId === CUSTOM_SPORT && (
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
        )}
        <TextareaField
          label="Описание"
          hint="Что будете делать, в каком темпе, кому подойдёт"
          rows={5}
          maxLength={EVENT_LIMITS.description.max}
          value={form.description}
          onChange={(e) => set('description')(e.target.value)}
          error={errors.description}
        />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Когда</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Дата"
            type="date"
            min={isoDay(0)}
            value={form.date}
            onChange={(e) => set('date')(e.target.value)}
            error={errors.date}
          />
          <TextField
            label="Начало"
            type="time"
            value={form.startTime}
            onChange={(e) => set('startTime')(e.target.value)}
          />
          <TextField
            label="Окончание"
            hint="Необязательно"
            type="time"
            value={form.endTime}
            onChange={(e) => set('endTime')(e.target.value)}
            error={errors.endsAt}
          />
        </div>
        <p className="text-sm text-ink-muted">{LOCAL_TIME_NOTE}</p>
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Где</h2>
        <TextField
          label="Адрес или место"
          hint="Так, чтобы человек нашёл без карты: улица и дом или понятное описание"
          placeholder="Остров Татышев, главный вход"
          maxLength={EVENT_LIMITS.address.max}
          value={form.address}
          onChange={(e) => set('address')(e.target.value)}
          error={errors.address ?? errors.venueId}
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
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-h3">Как записываться</h2>
        <RadioCards
          legend="Режим записи"
          value={form.joinMode}
          onChange={set('joinMode')}
          error={errors.joinMode}
          options={[
            {
              value: 'free',
              title: 'Свободная запись',
              text: 'Человек нажимает «Записаться» и сразу в списке участников',
            },
            {
              value: 'request',
              title: 'По заявке',
              text: 'Вы смотрите заявки и решаете, кого принять',
            },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Уровень подготовки"
            options={EVENT_LEVELS.map((value) => ({ value, label: EVENT_LEVEL_LABELS[value] }))}
            value={form.level}
            onChange={(e) => set('level')(e.target.value as EventLevel)}
            error={errors.level}
          />
          <TextField
            label="Сколько мест"
            hint="Пусто — без ограничения"
            type="number"
            inputMode="numeric"
            min={EVENT_LIMITS.capacity.min}
            max={EVENT_LIMITS.capacity.max}
            value={form.capacity}
            onChange={(e) => set('capacity')(e.target.value)}
            error={errors.capacity}
          />
        </div>
        <TextareaField
          label="Условия участия"
          hint="Необязательно: что взять, какая нужна подготовка, есть ли инвентарь"
          rows={3}
          maxLength={EVENT_LIMITS.requirements.max}
          value={form.requirements}
          onChange={(e) => set('requirements')(e.target.value)}
          error={errors.requirements}
        />
        <TextField
          label="Ссылка на чат участников"
          hint="Необязательно. Увидят только подтверждённые участники"
          type="url"
          placeholder="https://t.me/…"
          value={form.chatUrl}
          onChange={(e) => set('chatUrl')(e.target.value)}
          error={errors.chatUrl}
        />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={saving}>
          {saving ? 'Сохраняем…' : event ? 'Сохранить изменения' : 'Опубликовать встречу'}
        </Button>
        <ButtonLink to={event ? `/events/${event.id}` : '/'} variant="secondary" size="lg">
          Отмена
        </ButtonLink>
      </div>
    </form>
  );
}
