// Показывается, если страница упала при отрисовке или загрузке данных маршрута.
import { Link, useRouteError } from 'react-router';

export function ErrorPage() {
  console.error(useRouteError());
  return (
    <main className="page-container py-10">
      <section className="max-w-2xl rounded-lg border-2 border-ink bg-surface p-6 shadow-md">
        <h1 className="text-h2 mb-2">Что-то пошло не так</h1>
        <p className="mb-4">Обновите страницу. Если ошибка повторится, вернитесь на главную.</p>
        <Link to="/" className="font-semibold">
          На главную
        </Link>
      </section>
    </main>
  );
}
