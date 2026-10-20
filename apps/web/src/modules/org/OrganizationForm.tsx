// Форма организации: подача заявки и правка данных. Проверки — те же Zod-схемы, что на сервере.
// Виды спорта — список и «Свой вариант», как в форме события (ТЗ: «список + свой вариант»).
import { zodFieldErrors } from '@sport/shared';
import {
  createOrganizationBody,
  type CreateOrganizationBody,
  type OrganizationOwner,
} from '@sport/shared/schemas/organizations';
import { normalizeSportName, sportNameSchema, sportSlug } from '@sport/shared/schemas/sports';
import { useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Chip,
  FieldError,
  Skeleton,
  SportChip,
  TextareaField,
  TextField,
} from '../../shared/ui';
import { useSports } from './api';
import { useFreshErrors } from './errors';

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
  // Свои варианты, которых нет в каталоге: сервер добавит их при сохранении.
  const [sportNames, setSportNames] = useState<string[]>([]);
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const fresh = useFreshErrors(Object.keys(clientFields).length > 0 ? clientFields : serverFields);

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

  /** Свой вариант: такой уже есть в каталоге — отмечаем его, иначе добавляем новым. */
  const addCustom = (name: string): string => {
    fresh.edit('sportIds');
    const slug = sportSlug(name);
    const existing = sports.data?.find((sport) => sport.slug === slug);
    if (existing) {
      setSportIds((current) =>
        current.includes(existing.id) ? current : [...current, existing.id],
      );
      return `«${existing.name}» уже есть в списке — отметили его`;
    }
    const clean = normalizeSportName(name);
    if (sportNames.some((other) => sportSlug(other) === slug)) return `«${clean}» уже добавлен`;
    setSportNames((current) => [...current, clean]);
    return `Добавим «${clean}» в каталог, когда сохраните`;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    fresh.reset();
    const parsed = createOrganizationBody.safeParse({ ...form, sportIds, sportNames });
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
        error={fresh.errorOf('name')}
      />
      <TextField
        label="Вид объединения"
        hint="Клуб, кружок, федерация, компания, сообщество"
        value={form.activity}
        onChange={(e) => set('activity')(e.target.value)}
        error={fresh.errorOf('activity')}
      />
      <TextareaField
        label="Чем вы занимаетесь"
        hint="Для кого встречи, как часто, какой уровень подготовки нужен"
        rows={5}
        value={form.description}
        onChange={(e) => set('description')(e.target.value)}
        error={fresh.errorOf('description')}
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
            {/* Свои варианты до сохранения: нажатие убирает, как снятие отметки у чипа из списка. */}
            {sportNames.map((name, index) => (
              <SportChip
                key={`new:${name}`}
                sport={{ name, slug: sportSlug(name) }}
                index={sports.data.length + index}
                pressed
                onClick={() => {
                  fresh.edit('sportIds');
                  setSportNames((current) => current.filter((item) => item !== name));
                }}
              />
            ))}
          </div>
        )}
        {!sports.isPending && !sports.isError && <CustomSport onAdd={addCustom} />}
        {fresh.errorOf('sportIds') && <FieldError>{fresh.errorOf('sportIds')}</FieldError>}
        {fresh.errorOf('sportNames') && <FieldError>{fresh.errorOf('sportNames')}</FieldError>}
      </fieldset>

      <TextField
        label="Город"
        hint="Необязательно"
        autoComplete="address-level2"
        value={form.city}
        onChange={(e) => set('city')(e.target.value)}
        error={fresh.errorOf('city')}
      />
      <TextField
        label="Контакты"
        hint="Необязательно. Телефон, почта или ссылка на сообщество — их увидят все"
        value={form.contacts}
        onChange={(e) => set('contacts')(e.target.value)}
        error={fresh.errorOf('contacts')}
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

/**
 * «Свой вариант»: поле и кнопка «Добавить» (или Enter). Проверка — та же схема, что на сервере;
 * под полем — что стало с названием: отметили из списка или добавим в каталог.
 */
function CustomSport({ onAdd }: { onAdd: (name: string) => string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string | null>(null);

  const add = () => {
    const parsed = sportNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setNote(onAdd(parsed.data));
    setName('');
    setError(undefined);
  };

  if (!open) {
    return (
      <Chip pressed={false} icon="plus" className="self-start" onClick={() => setOpen(true)}>
        Свой вариант
      </Chip>
    );
  }
  return (
    <div className="flex flex-wrap items-start gap-3">
      <TextField
        label="Свой вид спорта"
        placeholder="Например: Скандинавская ходьба"
        hint={note ?? 'Нет в списке? Впишите — новый вид спорта появится в каталоге'}
        className="min-w-0 flex-[1_1_280px]"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined);
          setNote(null);
        }}
        onKeyDown={(e) => {
          // Enter добавляет вариант, а не отправляет всю форму.
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        error={error}
      />
      {/* Отступ сверху — высота подписи поля: кнопка стоит вровень с полем ввода. */}
      <Button variant="secondary" className="md:mt-8" onClick={add}>
        Добавить
      </Button>
    </div>
  );
}
