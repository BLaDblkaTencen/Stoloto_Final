// Форма организации: подача заявки и правка данных. Проверки — те же Zod-схемы, что на сервере.
import { zodFieldErrors } from '@sport/shared';
import {
  createOrganizationBody,
  type CreateOrganizationBody,
  type OrganizationOwner,
} from '@sport/shared/schemas/organizations';
import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  FieldError,
  Skeleton,
  SportChip,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { useSports } from './api';

type Props = {
  initial?: OrganizationOwner;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Общая ошибка запроса над формой. */
  requestError: string | null;
  /** Ошибки по полям от сервера (422, 409 ORG_NAME_TAKEN). */
  serverFields: Record<string, string>;
  onSubmit: (body: CreateOrganizationBody) => void;
  onCancel?: () => void;
};

export function OrganizationForm({
  initial,
  submitLabel,
  pendingLabel,
  pending,
  requestError,
  serverFields,
  onSubmit,
  onCancel,
}: Props) {
  const sports = useSports();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    activity: initial?.activity ?? '',
    description: initial?.description ?? '',
    city: initial?.city ?? '',
    contacts: initial?.contacts ?? '',
  });
  const [sportIds, setSportIds] = useState<string[]>(initial?.sports.map((s) => s.id) ?? []);
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const fields = Object.keys(clientFields).length > 0 ? clientFields : serverFields;

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleSport = (id: string) =>
    setSportIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = createOrganizationBody.safeParse({ ...form, sportIds });
    if (!parsed.success) return setClientFields(zodFieldErrors(parsed.error));
    setClientFields({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {requestError && <Alert>{requestError}</Alert>}

      <TextField
        label="Название"
        hint="Как вас будут видеть участники, например «Шахматный клуб „Ладья“»"
        value={form.name}
        onChange={(e) => set('name')(e.target.value)}
        error={fields.name}
      />
      <TextField
        label="Вид объединения"
        hint="Клуб, кружок, федерация, компания, сообщество"
        value={form.activity}
        onChange={(e) => set('activity')(e.target.value)}
        error={fields.activity}
      />
      <TextareaField
        label="Чем вы занимаетесь"
        hint="Для кого встречи, как часто, какой уровень подготовки нужен"
        rows={5}
        value={form.description}
        onChange={(e) => set('description')(e.target.value)}
        error={fields.description}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-semibold">Виды спорта</legend>
        {sports.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : sports.isError ? (
          <Alert tone="warning">Не удалось загрузить виды спорта. Обновите страницу</Alert>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {sports.data.map((sport, index) => (
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

      <TextField
        label="Город"
        hint="Необязательно"
        autoComplete="address-level2"
        value={form.city}
        onChange={(e) => set('city')(e.target.value)}
        error={fields.city}
      />
      <TextField
        label="Контакты"
        hint="Необязательно. Телефон, почта или ссылка на сообщество — их увидят все"
        value={form.contacts}
        onChange={(e) => set('contacts')(e.target.value)}
        error={fields.contacts}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
