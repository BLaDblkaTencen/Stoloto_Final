// Каталог допущенных организаций: поиск по названию и описанию, фильтр по виду спорта.
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonList,
  SportChip,
  TextField,
} from '../../shared/ui';
import { useOrganizations, useSports } from './api';
import { SportTag } from './SportTag';

const PAGE_SIZE = 20;

export function OrganizationsPage() {
  // Фильтры живут в адресе: ссылкой можно поделиться, «Назад» возвращает к тем же результатам.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const sportId = params.get('sport') ?? '';
  const offset = Number(params.get('offset')) || 0;
  const [text, setText] = useState(q);

  const sports = useSports();
  const list = useOrganizations({ q: q || undefined, sportId: sportId || undefined, offset });

  const update = (next: Record<string, string>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    update({ q: text.trim(), offset: '' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 mb-2">Клубы и сообщества</h1>
        <p className="text-ink-muted">
          Организации, допущенные на платформу. Откройте страницу, чтобы увидеть их встречи.
        </p>
      </div>

      <form onSubmit={search} role="search" className="flex flex-wrap items-end gap-3">
        <TextField
          label="Поиск"
          type="search"
          placeholder="Название или чем занимаются"
          className="min-w-64 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit">Найти</Button>
      </form>

      {sports.data && sports.data.length > 0 && (
        <div className="flex flex-wrap gap-2.5" aria-label="Вид спорта">
          {sports.data.map((sport, index) => (
            <SportChip
              key={sport.id}
              sport={sport}
              index={index}
              pressed={sport.id === sportId}
              onClick={() => update({ sport: sport.id === sportId ? '' : sport.id, offset: '' })}
            />
          ))}
        </div>
      )}

      {list.isPending ? (
        <SkeletonList count={3} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon="people"
          title="Ничего не нашли"
          text="Попробуйте другой запрос или уберите фильтр по виду спорта"
          action={
            (q || sportId) && (
              <Button
                variant="secondary"
                onClick={() => {
                  setText('');
                  update({ q: '', sport: '', offset: '' });
                }}
              >
                Сбросить фильтры
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4" aria-busy={list.isFetching || undefined}>
            {list.data.items.map((org) => (
              <li key={org.id}>
                <Card className="flex flex-col gap-3">
                  <h2 className="text-h3">
                    <Link to={`/organizations/${org.id}`}>{org.name}</Link>
                  </h2>
                  <p className="text-ink-muted">
                    {[org.activity, org.city].filter(Boolean).join(' · ')}
                  </p>
                  <p className="line-clamp-3">{org.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {org.sports.map((sport) => (
                      <SportTag key={sport.id} sport={sport} />
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pager
            offset={offset}
            total={list.data.total}
            onChange={(next) => update({ offset: next ? String(next) : '' })}
          />
        </>
      )}
    </div>
  );
}

function Pager({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.ceil(total / PAGE_SIZE);
  return (
    <nav aria-label="Страницы" className="flex items-center justify-center gap-4">
      <Button
        variant="secondary"
        disabled={offset === 0}
        onClick={() => onChange(offset - PAGE_SIZE)}
      >
        Назад
      </Button>
      <span className="font-semibold">
        Страница {page} из {pages}
      </span>
      <Button
        variant="secondary"
        disabled={offset + PAGE_SIZE >= total}
        onClick={() => onChange(offset + PAGE_SIZE)}
      >
        Дальше
      </Button>
    </nav>
  );
}
