// Раскладка всех страниц: шапка, содержимое, подвал. Владелец: участник 3.
// Пункты меню — в MainNav.tsx.
import { Link, Outlet } from 'react-router';
import { AccountMenu } from '../modules/auth/AccountMenu';
import { useMe } from '../modules/auth/api';
import { Icon } from '../shared/ui';
import { MainNav } from './MainNav';
import { PageBackground } from './PageBackground';

export function Layout() {
  const me = useMe();
  // Создать встречу может участник и организация; гостя форма сначала попросит войти.
  const canCreate = !me.isPending && me.data?.role !== 'admin';
  return (
    // isolate: фон с -z-10 остаётся внутри раскладки, под содержимым, но над фоном body.
    <div className="isolate flex min-h-screen flex-col">
      <PageBackground />
      <header className="page-container flex flex-wrap items-center justify-between gap-4 py-5">
        {/* Логотип не перекрашивается при наведении, как обычные ссылки (a:hover в index.css). */}
        <Link to="/" className="flex items-center gap-2.5 no-underline hover:text-ink">
          <span
            aria-hidden="true"
            className="inline-flex size-11 items-center justify-center rounded-[14px] border-2 border-ink bg-accent font-display text-[22px] font-bold shadow-sm"
          >
            в
          </span>
          <span className="font-display text-[26px] font-bold">вместе</span>
        </Link>
        <MainNav />
        <div className="flex flex-wrap items-center gap-3">
          <AccountMenu />
          {canCreate && (
            // Двухцветная кнопка: жёлтый сегмент с плюсом, как логотип, и белое поле, как «Войти».
            // Заметна, но не перетягивает внимание, как сплошная тёмная.
            <Link
              to="/events/new"
              className="inline-flex min-h-[var(--control-height)] items-stretch overflow-hidden rounded-md border-2 border-ink bg-surface text-sm font-semibold text-ink no-underline shadow-sm transition-[translate,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:text-ink hover:shadow-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <span className="inline-flex w-11 items-center justify-center border-r-2 border-ink bg-accent">
                <Icon name="plus" />
              </span>
              <span className="inline-flex items-center px-4">Создать встречу</span>
            </Link>
          )}
        </div>
      </header>

      <main className="page-container flex-1 py-6">
        <Outlet />
      </main>

      <footer className="border-t-2 border-ink bg-surface">
        <div className="page-container flex flex-wrap justify-between gap-4 py-6 text-sm">
          <span>
            <span className="font-display font-bold">вместе © 2026</span> · прототип для финала ЧР
            по продуктовому программированию, кейс Столото
          </span>
          <nav aria-label="Дополнительно" className="flex flex-wrap gap-5">
            <Link to="/map">Карта и площадки</Link>
            <Link to="/organizations">Организации</Link>
            <Link to="/org">Для организаций</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
