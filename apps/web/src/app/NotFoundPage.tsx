import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="max-w-2xl rounded-lg border-2 border-ink bg-surface p-6 shadow-md">
      <h1 className="text-h2 mb-2">Страница не найдена</h1>
      <p className="mb-4">Возможно, ссылка устарела или в адресе опечатка.</p>
      <Link to="/" className="font-semibold">
        На главную
      </Link>
    </section>
  );
}
