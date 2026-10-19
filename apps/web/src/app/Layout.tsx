// Раскладка всех страниц: шапка, содержимое, подвал. Владелец: участник 3.
// Пункты меню и кнопка аккаунта появятся вместе с экранами зон и входом (задача 3.2).
import { Link, Outlet } from 'react-router';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="page-container flex flex-wrap items-center justify-between gap-4 py-5">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span
            aria-hidden="true"
            className="inline-flex size-11 items-center justify-center rounded-[14px] border-2 border-ink bg-accent font-display text-[22px] font-bold shadow-sm"
          >
            в
          </span>
          <span className="font-display text-[26px] font-bold">вместе</span>
        </Link>
      </header>

      <main className="page-container flex-1 py-6">
        <Outlet />
      </main>

      <footer className="border-t-2 border-ink bg-surface">
        <div className="page-container py-6 text-sm">
          Прототип для финала ЧР по продуктовому программированию, кейс Столото
        </div>
      </footer>
    </div>
  );
}
