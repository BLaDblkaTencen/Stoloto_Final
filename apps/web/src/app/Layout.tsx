// Раскладка всех страниц: шапка, содержимое, подвал. Владелец: участник 3.
// Пункты меню — в MainNav.tsx.
import { Link, Outlet } from 'react-router';
import { AccountMenu } from '../modules/auth/AccountMenu';
import { useMe } from '../modules/auth/api';
import { ButtonLink, Icon } from '../shared/ui';
import { MainNav } from './MainNav';

export function Layout() {
  const me = useMe();
  // Создать встречу может участник и организация; гостя форма сначала попросит войти.
  const canCreate = !me.isPending && me.data?.role !== 'admin';
  return (
    <div className="flex min-h-screen flex-col">
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
            <ButtonLink to="/events/new" variant="dark">
              <Icon name="plus" />
              Создать встречу
            </ButtonLink>
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
