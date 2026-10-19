// Профиль пользователя (задача 1.9): публичная страница автора события и правка своего профиля.
// Email и пароль здесь не показываются и не меняются.
import { zodFieldErrors } from '@sport/shared';
import {
  PROFILE_LIMITS,
  updateProfileSchema,
  type UserProfile,
} from '@sport/shared/schemas/profiles';
import type { EventListItem } from '@sport/shared/schemas/events';
import type { Sport } from '@sport/shared/schemas/sports';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  FieldError,
  Icon,
  JoinModeBadge,
  Skeleton,
  SkeletonList,
  SportChip,
  sportColor,
  sportIcon,
  StatusBadge,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { formErrors, useFreshErrors } from '../org/errors';
import { useMyRegistrations, useProfile, useSports, useUpdateProfile } from './api';
import { MetaLine } from './EventBits';
import { sportTileClass } from './EventFormParts';
import { formatSeats, formatSince, formatWhen } from './format';

export function ProfilePage() {
  const { id = '' } = useParams();
  const me = useMe();
  const profile = useProfile(id);

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <SkeletonList count={2} />
      </div>
    );
  }
  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.status === 404) {
      return (
        <EmptyState
          icon="eyeOff"
          title="Пользователь не найден"
          text="Возможно, ссылка неверная."
          action={<ButtonLink to="/">Все встречи</ButtonLink>}
        />
      );
    }
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  }

  return <ProfileView profile={profile.data} isMe={me.data?.id === profile.data.id} />;
}

/** Подсказки к «О себе»: нажатие дописывает фразу, дальше человек правит её сам. */
const ABOUT_PROMPTS = [
  'Занимаюсь с … года.',
  'Мой уровень: …',
  'Ищу компанию для …',
  'Удобно по утрам / вечерам.',
];

/** Дописать подсказку новым предложением: после текста без точки ставим точку. */
function appendPrompt(text: string, prompt: string) {
  const current = text.trim();
  if (!current) return prompt;
  return `${current}${/[.!?…]$/.test(current) ? '' : '.'} ${prompt}`;
}

type Tab = 'organizes' | 'joins' | 'interests';

/**
 * Профиль как страница клуба: обложка в цвете любимого вида спорта, крупный аватар, вкладки
 * «Собирает», «Мои записи» (только свой профиль: куда человек ходит, видит он один) и «Интересы».
 */
function ProfileView({ profile, isMe }: { profile: UserProfile; isMe: boolean }) {
  const [tab, setTab] = useState<Tab>('organizes');
  const mine = useMyRegistrations(isMe, 20);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'organizes', label: `Собирает · ${profile.upcomingEvents.length}` },
    ...(isMe && mine.data
      ? [{ key: 'joins' as const, label: `Мои записи · ${mine.data.total}` }]
      : []),
    { key: 'interests', label: `Интересы · ${profile.sports.length}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Cover sports={profile.sports} />
        <div className="relative -mt-14 flex flex-wrap items-start gap-4 px-4 sm:px-6">
          <span className="rounded-full shadow-md">
            <Avatar name={profile.name} size={112} />
          </span>
          <div className="mt-16 flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-h2 leading-tight">{profile.name}</h1>
            <p className="text-ink-muted">
              {[profile.city, `на «Вместе» с ${formatSince(profile.memberSince)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {isMe && (
            <ButtonLink to="/me/profile" variant="secondary" className="mt-16">
              Изменить профиль
            </ButtonLink>
          )}
        </div>
      </div>

      {profile.about ? (
        <p className="max-w-3xl text-lg whitespace-pre-line">{profile.about}</p>
      ) : (
        isMe && (
          <p className="text-ink-muted">
            Расскажите о себе в <Link to="/me/profile">профиле</Link>: опыт и любимые занятия увидит
            организатор в вашей заявке.
          </p>
        )
      )}

      <div
        role="tablist"
        aria-label="Разделы профиля"
        className="flex flex-wrap gap-x-7 border-b-2 border-line-soft"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`min-h-[var(--control-height)] cursor-pointer font-semibold transition-[box-shadow] ${tab === item.key ? 'shadow-[inset_0_-4px_0_var(--color-accent)]' : 'hover:shadow-[inset_0_-4px_0_var(--color-line-soft)]'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'organizes' &&
          (profile.upcomingEvents.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Ближайших встреч нет"
              text={isMe ? 'Соберите людей на своё занятие, это пара минут.' : undefined}
              action={isMe ? <ButtonLink to="/events/new">Создать встречу</ButtonLink> : undefined}
            />
          ) : (
            <CardGrid>
              {profile.upcomingEvents.map((event) => (
                <ProfileEventCard key={event.id} event={event} />
              ))}
            </CardGrid>
          ))}
        {tab === 'joins' &&
          mine.data &&
          (mine.data.items.length === 0 ? (
            <EmptyState
              icon="people"
              title="Вы пока никуда не записаны"
              action={<ButtonLink to="/">Найти встречу</ButtonLink>}
            />
          ) : (
            <CardGrid>
              {mine.data.items.map((item) => (
                <ProfileEventCard
                  key={item.id}
                  event={item}
                  status={
                    item.status === 'published' ? (
                      <StatusBadge kind="registration" status={item.myRegistration.status} />
                    ) : (
                      <StatusBadge kind="event" status={item.status} />
                    )
                  }
                />
              ))}
            </CardGrid>
          ))}
        {tab === 'interests' &&
          (profile.sports.length === 0 ? (
            <p className="text-ink-muted">Интересы пока не указаны.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {profile.sports.map((sport) => (
                <Link
                  key={sport.id}
                  to={`/?sport=${sport.id}`}
                  className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-ink p-3 text-center font-semibold no-underline transition-[translate,box-shadow] duration-100 hover:-translate-y-0.5 hover:shadow-sm"
                  style={{ background: sportColor(sport.slug) }}
                >
                  <Icon name={sportIcon(sport.slug)} size={32} strokeWidth={1.7} />
                  {sport.name}
                </Link>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

/** Обложка: точечный узор в цвете первого интереса и до трёх «марок» с видами спорта. */
function Cover({ sports }: { sports: Sport[] }) {
  const color = sports[0] ? sportColor(sports[0].slug) : 'var(--color-accent)';
  const places = [
    { right: '6%', top: '18%', rotate: '8deg' },
    { right: '17%', top: '46%', rotate: '-6deg' },
    { right: '29%', top: '16%', rotate: '4deg' },
  ];
  return (
    <div
      aria-hidden="true"
      className="relative h-36 overflow-hidden rounded-lg border-2 border-ink"
      style={{
        backgroundColor: color,
        backgroundImage: 'radial-gradient(var(--color-ink) 1.2px, transparent 1.3px)',
        backgroundSize: '18px 18px',
      }}
    >
      {sports.slice(0, 3).map((sport, index) => (
        <span
          key={sport.id}
          className="absolute hidden size-14 items-center justify-center rounded-md border-2 border-ink shadow-sm sm:inline-flex"
          style={{
            ...places[index],
            background: index ? sportColor(sport.slug) : 'var(--color-surface)',
          }}
        >
          <Icon name={sportIcon(sport.slug)} size={28} strokeWidth={1.8} />
        </span>
      ))}
    </div>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

/** Встреча в профиле: цветная шапка с видом спорта и режимом, ниже когда, где и места. */
function ProfileEventCard({ event, status }: { event: EventListItem; status?: ReactNode }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-sm">
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-4 py-2.5 font-semibold"
        style={{ background: sportColor(event.sport.slug) }}
      >
        <span className="flex items-center gap-2">
          <Icon name={sportIcon(event.sport.slug)} size={20} />
          {event.sport.name}
        </span>
        <JoinModeBadge mode={event.joinMode} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-[19px] leading-snug">
          <Link to={`/events/${event.id}`} className="no-underline hover:underline">
            {event.title}
          </Link>
        </h3>
        <MetaLine icon="calendar">{formatWhen(event.startsAt, event.endsAt)}</MetaLine>
        <MetaLine icon="pin">{event.address}</MetaLine>
        <MetaLine icon="people">{formatSeats(event.participantsCount, event.capacity)}</MetaLine>
        {status && <div className="mt-1">{status}</div>}
      </div>
    </article>
  );
}

export function EditProfileRoute() {
  return (
    <RequireAuth>
      <EditProfileScreen />
    </RequireAuth>
  );
}

function EditProfileScreen() {
  const me = useMe();
  const profile = useProfile(me.data?.id ?? '');
  if (profile.isPending) return <SkeletonList count={2} />;
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const navigate = useNavigate();
  const sports = useSports();
  const save = useUpdateProfile();
  const [form, setForm] = useState({
    name: profile.name,
    city: profile.city ?? '',
    about: profile.about ?? '',
  });
  const [sportIds, setSportIds] = useState(profile.sports.map((sport) => sport.id));
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const server = formErrors(save.error, 'Не получилось сохранить. Попробуйте ещё раз');
  const fresh = useFreshErrors(Object.keys(clientFields).length > 0 ? clientFields : server.fields);

  const set = (key: keyof typeof form) => (value: string) => {
    fresh.edit(key);
    setForm((current) => ({ ...current, [key]: value }));
  };
  const toggleSport = (id: string) => {
    fresh.edit('sportIds');
    setSportIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    fresh.reset();
    const body = { ...form, sportIds };
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) return setClientFields(zodFieldErrors(parsed.error));
    setClientFields({});
    save.mutate(body, { onSuccess: (saved) => navigate(`/users/${saved.id}`) });
  };

  // Выбранные интересы в порядке выбора: первый задаёт цвет обложки, как в профиле.
  const chosen = sportIds
    .map((id) => sports.data?.find((sport) => sport.id === id))
    .filter((sport): sport is Sport => Boolean(sport));
  const shown = {
    name: form.name.trim() || profile.name,
    city: form.city.trim(),
    about: form.about.trim(),
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/users/${profile.id}`} className="self-start font-semibold">
        ← Мой профиль
      </Link>
      <div>
        <Cover sports={chosen} />
        <div className="relative -mt-14 flex flex-wrap items-start gap-4 px-4 sm:px-6">
          <span className="rounded-full shadow-md">
            <Avatar name={shown.name} size={112} />
          </span>
          <div className="mt-16 flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-h2 leading-tight">Мой профиль</h1>
            <p className="text-ink-muted">
              Так вас видят участники и организаторы встреч. Обложка — в цвете первого интереса.
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6">
          {server.message && <Alert>{server.message}</Alert>}
          <Card className="flex flex-col gap-5">
            <h2 className="text-h3">Как к вам обращаться</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Имя"
                hint="В списке участников и в обсуждениях"
                autoComplete="name"
                maxLength={PROFILE_LIMITS.name.max}
                value={form.name}
                onChange={(e) => set('name')(e.target.value)}
                error={fresh.errorOf('name')}
              />
              <TextField
                label="Город или район"
                hint="Необязательно"
                autoComplete="address-level2"
                placeholder="Красноярск, Октябрьский район"
                maxLength={PROFILE_LIMITS.city.max}
                value={form.city}
                onChange={(e) => set('city')(e.target.value)}
                error={fresh.errorOf('city')}
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h3">О себе</h2>
              <span className="text-sm text-ink-muted tabular-nums">
                {form.about.length} из {PROFILE_LIMITS.about.max}
              </span>
            </div>
            <TextareaField
              label="Пара слов о себе"
              hint="Необязательно. Организатор увидит это, когда вы подаёте заявку"
              rows={5}
              placeholder="Бегаю по утрам, 5 км в спокойном темпе. Хочу найти компанию для футбола по выходным."
              maxLength={PROFILE_LIMITS.about.max}
              value={form.about}
              onChange={(e) => set('about')(e.target.value)}
              error={fresh.errorOf('about')}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-muted">Можно рассказать:</span>
              <div className="flex flex-wrap gap-2">
                {ABOUT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => set('about')(appendPrompt(form.about, prompt))}
                    className="min-h-[var(--control-height)] cursor-pointer rounded-full border-2 border-dashed border-ink bg-surface-muted px-4 text-sm font-semibold transition-[translate] duration-100 hover:-translate-y-0.5"
                  >
                    + {prompt}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h3">Чем любите заниматься</h2>
              <span className="text-sm text-ink-muted">
                {chosen.length ? `Выбрано: ${chosen.length}` : 'Можно выбрать несколько'}
              </span>
            </div>
            {sports.isPending ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))]">
                {(sports.data ?? []).map((sport) => {
                  const on = sportIds.includes(sport.id);
                  return (
                    <button
                      key={sport.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSport(sport.id)}
                      className={sportTileClass(on)}
                      style={{
                        background: on ? sportColor(sport.slug) : undefined,
                        rotate: on ? '-1.5deg' : undefined,
                      }}
                    >
                      <Icon name={sportIcon(sport.slug)} size={30} strokeWidth={1.7} />
                      {sport.name}
                    </button>
                  );
                })}
              </div>
            )}
            {fresh.errorOf('sportIds') && <FieldError>{fresh.errorOf('sportIds')}</FieldError>}
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" loading={save.isPending}>
              Сохранить профиль
            </Button>
            <ButtonLink to={`/users/${profile.id}`} variant="secondary" size="lg">
              Отмена
            </ButtonLink>
          </div>
        </form>

        <aside aria-label="Так вас увидят" className="flex flex-col gap-3 lg:sticky lg:top-6">
          <span className="font-semibold">Так вас увидят</span>
          <div className="overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-md">
            <div
              aria-hidden="true"
              className="h-16 border-b-2 border-ink"
              style={{
                backgroundColor: chosen[0] ? sportColor(chosen[0].slug) : 'var(--color-accent)',
                backgroundImage: 'radial-gradient(var(--color-ink) 1.2px, transparent 1.3px)',
                backgroundSize: '14px 14px',
              }}
            />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-2">
                <span className="-mt-12 self-start rounded-full bg-surface">
                  <Avatar name={shown.name} size={64} />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg leading-tight font-bold">{shown.name}</p>
                  {shown.city && <p className="text-sm text-ink-muted">{shown.city}</p>}
                </div>
              </div>
              <p className={`line-clamp-4 ${shown.about ? '' : 'text-ink-muted'}`}>
                {shown.about || 'Здесь будет рассказ о вас.'}
              </p>
              {chosen.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chosen.map((sport) => (
                    <span
                      key={sport.id}
                      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-semibold"
                      style={{ background: sportColor(sport.slug) }}
                    >
                      <Icon name={sportIcon(sport.slug)} size={16} />
                      {sport.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="rounded-md border-2 border-ink bg-surface-muted p-3 text-sm">
            Организатор видит эту карточку, когда вы подаёте заявку на встречу «по заявке». Email и
            пароль здесь не показываются.
          </p>
        </aside>
      </div>
    </div>
  );
}
