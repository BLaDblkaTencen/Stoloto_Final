// Временная страница каркаса: показывает, что фронтенд, API и база связаны.
// Удаляется, когда участник 1 подключит ленту мероприятий на главную.
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api/client';

type Health = { status: 'ok' | 'degraded'; db: 'ok' | 'error' };

export function StartPage() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<Health>('/health') });

  const server = health.isPending ? 'проверяем…' : health.isError ? 'недоступен' : 'работает';
  const database = health.data?.db === 'ok' ? 'подключена' : health.isPending ? '…' : 'недоступна';

  return (
    <section className="max-w-2xl rounded-lg border-2 border-ink bg-surface p-6 shadow-md">
      <h1 className="text-h2 mb-4">Каркас работает</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-semibold">Сервер</dt>
        <dd>{server}</dd>
        <dt className="font-semibold">База данных</dt>
        <dd>{database}</dd>
      </dl>
    </section>
  );
}
