// Раскладка всех страниц: шапка, содержимое, подвал. Владелец: участник 3.
// Пункты меню — в MainNav.tsx, подвал — в Footer.tsx.
import { Link, Outlet } from 'react-router';
import { AccountMenu } from '../modules/auth/AccountMenu';
import { useMe } from '../modules/auth/api';
import { Icon } from '../shared/ui';
import { Footer } from './Footer';
import { Logo } from './Logo';
import { MainNav } from './MainNav';
import { PageBackground } from './PageBackground';
import { SportIllustration } from './SportIllustration';

export function Layout() {
  const me = useMe();
  // Создать встречу может участник и организация; гостя форма сначала попросит войти.
  const canCreate = !me.isPending && me.data?.role !== 'admin';
  return (
    // isolate: фон с -z-10 остаётся внутри раскладки, под содержимым, но над фоном body.
    <div className="isolate flex min-h-screen flex-col">
      <PageBackground />
      <header className="page-container flex flex-wrap items-center justify-between gap-4 py-5">
        <Logo />
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

      {/* relative: спортсмен над подвалом стоит у нижнего правого края содержимого. */}
      <main className="page-container relative flex-1 py-6">
        <SportIllustration />
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
