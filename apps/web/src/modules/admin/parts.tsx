// Общие куски экранов админки: фильтр по статусу, поиск, листание, журнал решений.
import type { AuditAction } from '@sport/shared';
import type { AuditEntry } from '@sport/shared/schemas/admin';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { formatDateTime } from '../../shared/format';
import { Button, Chip, TextField } from '../../shared/ui';

export const PAGE_SIZE = 20;

const AUDIT_LABELS: Record<AuditAction, string> = {
  'org.approve': 'Заявка одобрена',
  'org.reject': 'Заявка отклонена',
  'event.unpublish': 'Снято с публикации',
  'event.delete': 'Удалено',
  'comment.hide': 'Сообщение скрыто',
};

/** Фильтры списка живут в адресе (?status=…&q=…&page=…): работают «Назад» и ссылка на выборку. */
export function useListParams(defaultStatus: string) {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? defaultStatus;
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  return { status, q, page, update };
}

export function StatusFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-3">
      {options.map((option, index) => (
        <Chip
          key={option.value}
          index={index}
          pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

export function SearchForm({
  label,
  value,
  onSearch,
}: {
  label: string;
  value: string;
  onSearch: (q: string) => void;
}) {
  const [text, setText] = useState(value);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(text.trim());
  };
  return (
    <form role="search" onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <TextField
        label={label}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-[16rem] flex-1"
      />
      <Button type="submit">Найти</Button>
    </form>
  );
}

export function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Страницы списка" className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Предыдущие
      </Button>
      <span>
        {from}–{to} из {total}
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Следующие
      </Button>
    </nav>
  );
}

export function History({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">История решений</h2>
      <ol className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={`${entry.action}-${entry.createdAt}`}
            className="rounded-md border-2 border-line-soft bg-surface p-3"
          >
            <div className="font-semibold">
              {AUDIT_LABELS[entry.action]} · {formatDateTime(entry.createdAt)}
            </div>
            <div className="text-sm text-ink-muted">Администратор: {entry.actor.name}</div>
            {entry.reason && <div className="mt-1">Причина: {entry.reason}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}
