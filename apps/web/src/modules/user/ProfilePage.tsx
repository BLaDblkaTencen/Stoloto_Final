// Профиль пользователя (задача 1.9): публичная страница автора события и правка своего профиля.
// Email и пароль здесь не показываются и не меняются.
import { zodFieldErrors } from '@sport/shared';
import {
  PROFILE_LIMITS,
  updateProfileSchema,
  type UserProfile,
} from '@sport/shared/schemas/profiles';
import { useState, type FormEvent } from 'react';
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
  Skeleton,
  SkeletonList,
  SportChip,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { RequireAuth } from '../auth/RequireAuth';
import { useMe } from '../auth/api';
import { formErrors } from '../org/errors';
import { useProfile, useSports, useUpdateProfile } from './api';
import { EventCard } from './EventCard';

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

  const data = profile.data;
  const isMe = me.data?.id === data.id;
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={data.name} size={72} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-h2 leading-tight">{data.name}</h1>
            {data.city && <p className="text-ink-muted">{data.city}</p>}
          </div>
          {isMe && (
            <ButtonLink to="/me/profile" variant="secondary">
              Изменить профиль
            </ButtonLink>
          )}
        </div>
        {data.about && <p className="whitespace-pre-line">{data.about}</p>}
        {data.sports.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">Интересы</h2>
            <div className="flex flex-wrap gap-2">
              {data.sports.map((sport) => (
                <Badge key={sport.id} icon={null}>
                  {sport.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Организует</h2>
        {data.upcomingEvents.length === 0 ? (
          <p className="text-ink-muted">Ближайших встреч нет.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
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
  const fields = Object.keys(clientFields).length > 0 ? clientFields : server.fields;

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggleSport = (id: string) =>
    setSportIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, sportIds };
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) return setClientFields(zodFieldErrors(parsed.error));
    setClientFields({});
    save.mutate(body, { onSuccess: (saved) => navigate(`/users/${saved.id}`) });
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link to={`/users/${profile.id}`} className="self-start font-semibold">
        ← Мой профиль
      </Link>
      <h1 className="text-h2">Профиль</h1>
      <Card>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {server.message && <Alert>{server.message}</Alert>}
          <TextField
            label="Имя"
            hint="Его увидят в списке участников и в обсуждениях"
            autoComplete="name"
            maxLength={PROFILE_LIMITS.name.max}
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
            error={fields.name}
          />
          <TextField
            label="Город"
            hint="Необязательно"
            autoComplete="address-level2"
            maxLength={PROFILE_LIMITS.city.max}
            value={form.city}
            onChange={(e) => set('city')(e.target.value)}
            error={fields.city}
          />
          <TextareaField
            label="О себе"
            hint="Необязательно: опыт, чем любите заниматься. Организатор увидит это в заявке"
            rows={4}
            maxLength={PROFILE_LIMITS.about.max}
            value={form.about}
            onChange={(e) => set('about')(e.target.value)}
            error={fields.about}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-semibold">Интересы</legend>
            {sports.isPending ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {(sports.data ?? []).map((sport, index) => (
                  <SportChip
                    key={sport.id}
                    sport={sport}
                    index={index}
                    pressed={sportIds.includes(sport.id)}
                    onClick={() => toggleSport(sport.id)}
                  />
                ))}
              </div>
            )}
            {fields.sportIds && <FieldError>{fields.sportIds}</FieldError>}
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" loading={save.isPending}>
              Сохранить
            </Button>
            <ButtonLink to={`/users/${profile.id}`} variant="secondary" size="lg">
              Отмена
            </ButtonLink>
          </div>
        </form>
      </Card>
    </div>
  );
}
