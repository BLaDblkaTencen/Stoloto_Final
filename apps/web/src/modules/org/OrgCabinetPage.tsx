// Кабинет организации (задачи 2.2, 2.3): подача заявки, её статус, правка данных, повторная подача.
import type { OrgStatus } from '@sport/shared';
import type { OrganizationOwner } from '@sport/shared/schemas/organizations';
import { useState } from 'react';
import { RequireAuth } from '../auth/RequireAuth';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Icon,
  SkeletonList,
  StatusBadge,
} from '../../shared/ui';
import {
  useCreateOrganization,
  useMyOrganization,
  useResubmitOrganization,
  useUpdateOrganization,
} from './api';
import { formErrors } from './errors';
import { OrganizationForm } from './OrganizationForm';
import { SportTag } from './SportTag';

/** Маршрут /org: кабинет доступен только аккаунту организации. */
export function OrgCabinetRoute() {
  return (
    <RequireAuth roles={['organization']}>
      <OrgCabinetPage />
    </RequireAuth>
  );
}

export function OrgCabinetPage() {
  const mine = useMyOrganization();

  if (mine.isPending) return <SkeletonList count={2} />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />;
  return mine.data ? <Cabinet org={mine.data} /> : <Apply />;
}

function Apply() {
  const create = useCreateOrganization();
  const { message, fields } = formErrors(create.error, 'Не удалось отправить заявку');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-h2 mb-2">Заявка на допуск организации</h1>
        <p className="text-ink-muted">
          Расскажите о клубе или сообществе. Администратор проверит заявку, после допуска у
          организации появится своя страница, а события будут публиковаться сразу.
        </p>
      </div>
      <Steps status={null} />
      <Card>
        <OrganizationForm
          submitLabel="Отправить заявку"
          pendingLabel="Отправляем…"
          pending={create.isPending}
          requestError={message}
          serverFields={fields}
          onSubmit={(body) => create.mutate(body)}
        />
      </Card>
    </div>
  );
}

function Cabinet({ org }: { org: OrganizationOwner }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = useUpdateOrganization();
  const resubmit = useResubmitOrganization();
  const { message, fields } = formErrors(update.error, 'Не удалось сохранить изменения');

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h2">{org.name}</h1>
        <StatusBadge kind="organization" status={org.status} />
      </div>

      <Steps status={org.status} />

      {org.status === 'pending' && (
        <Alert tone="warning">
          Заявка на рассмотрении. Пока администратор её не одобрит, публиковать события нельзя.
          Решение появится на этой странице.
        </Alert>
      )}
      {org.status === 'rejected' && (
        <Card className="flex flex-col gap-4">
          <Alert>
            Заявка отклонена
            {org.rejectionReason ? `: ${org.rejectionReason}` : ''}. Исправьте данные и подайте
            заявку заново.
          </Alert>
          {resubmit.error && (
            <Alert>{formErrors(resubmit.error, 'Не удалось подать заявку').message}</Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setEditing(true)} disabled={editing}>
              Исправить данные
            </Button>
            <Button loading={resubmit.isPending} onClick={() => resubmit.mutate()}>
              {resubmit.isPending ? 'Отправляем…' : 'Подать заявку заново'}
            </Button>
          </div>
        </Card>
      )}
      {org.status === 'approved' && (
        <Card tone="success" className="flex flex-col gap-4">
          <p className="font-semibold">
            Организация допущена. Ваши события публикуются сразу, без повторной проверки.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/events/new">Опубликовать событие</ButtonLink>
            <ButtonLink to="/me/events" variant="secondary">
              Наши события и заявки
            </ButtonLink>
            <ButtonLink to={`/organizations/${org.id}`} variant="secondary">
              Публичная страница
            </ButtonLink>
          </div>
        </Card>
      )}

      {saved && !editing && <Alert tone="success">Изменения сохранены</Alert>}

      {editing ? (
        <Card>
          <h2 className="text-h3 mb-4">Данные организации</h2>
          <OrganizationForm
            initial={org}
            submitLabel="Сохранить"
            pendingLabel="Сохраняем…"
            pending={update.isPending}
            requestError={message}
            serverFields={fields}
            onSubmit={(body) =>
              update.mutate(body, {
                onSuccess: () => {
                  setEditing(false);
                  setSaved(true);
                },
              })
            }
            onCancel={() => {
              update.reset();
              setEditing(false);
            }}
          />
        </Card>
      ) : (
        <Profile
          org={org}
          onEdit={() => {
            setSaved(false);
            setEditing(true);
          }}
        />
      )}
    </div>
  );
}

function Profile({ org, onEdit }: { org: OrganizationOwner; onEdit: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-h3">Данные организации</h2>
        <Button variant="secondary" onClick={onEdit}>
          Изменить
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold">Вид объединения</dt>
        <dd>{org.activity}</dd>
        <dt className="font-semibold">Город</dt>
        <dd>{org.city ?? 'Не указан'}</dd>
        <dt className="font-semibold">Контакты</dt>
        <dd className="break-words">{org.contacts ?? 'Не указаны'}</dd>
      </dl>
      <p className="whitespace-pre-line">{org.description}</p>
      <div className="flex flex-wrap gap-2">
        {org.sports.map((sport) => (
          <SportTag key={sport.id} sport={sport} />
        ))}
      </div>
    </Card>
  );
}

const STEPS = ['Заявка подана', 'Проверка администратором', 'Организация допущена'];

/** Где сейчас заявка: понятная полоса из трёх шагов. */
function Steps({ status }: { status: OrgStatus | null }) {
  const current = status === null ? 0 : status === 'approved' ? 3 : 1;
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Этапы допуска">
      {STEPS.map((title, index) => {
        const done = index < current;
        const active = index === current && status !== 'rejected';
        const failed = status === 'rejected' && index === 1;
        return (
          <li
            key={title}
            aria-current={active ? 'step' : undefined}
            className={[
              'flex items-center gap-3 rounded-md border-2 p-3 font-semibold',
              done ? 'border-ink bg-status-success' : '',
              failed ? 'border-ink bg-status-danger' : '',
              active ? 'border-ink bg-status-warning' : '',
              !done && !failed && !active ? 'border-line-soft bg-surface text-ink-muted' : '',
            ].join(' ')}
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-surface">
              {done ? (
                <Icon name="check" size={18} />
              ) : failed ? (
                <Icon name="cross" size={18} />
              ) : (
                index + 1
              )}
            </span>
            {failed ? 'Заявка отклонена' : title}
          </li>
        );
      })}
    </ol>
  );
}
