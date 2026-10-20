// Раскладка всех страниц: шапка с беговой дорожкой, содержимое, подвал, вкладки внизу экрана.
// Владелец: участник 3. Пункты меню — в MainNav.tsx, дорожка — в RunningTrack.tsx,
// подвал — в Footer.tsx.
import { useRef } from 'react';
import { Link, Outlet } from 'react-router';
import { AccountMenu } from '../modules/auth/AccountMenu';
import { useMe } from '../modules/auth/api';
import { Icon } from '../shared/ui';
import { Footer } from './Footer';
import { Logo } from './Logo';
import { MainNav, TabBar } from './MainNav';
import { PageBackground } from './PageBackground';
import { HeaderTrack } from './RunningTrack';
import { SportIllustration } from './SportIllustration';

export function Layout() {
  const me = useMe();
  const navRef = useRef<HTMLElement>(null);
  // Создать встречу может участник и организация; гостя форма сначала попросит войти.
  const canCreate = !me.isPending && me.data?.role !== 'admin';
  return (
    // isolate: фон с -z-10 остаётся внутри раскладки, под содержимым, но над фоном body.
    // --tabbar-height: уже xl внизу экрана вкладки, подвал и прилипающие панели встают над ними.
    <div className="isolate flex min-h-screen flex-col max-xl:pb-[var(--tabbar-height)] max-xl:[--tabbar-height:calc(76px+env(safe-area-inset-bottom))]">
      <PageBackground />
      {/* Белая шапка с дорожкой снизу отделяет меню от страницы. */}
      <header className="bg-surface">
        <div className="page-container flex items-center justify-between gap-4 py-3">
          <Logo />
          <MainNav ref={navRef} />
          <div className="flex items-center gap-3">
            <AccountMenu />
            {canCreate && (
              // Двухцветная кнопка: жёлтый сегмент с плюсом, как логотип, и белое поле, как
              // «Войти». На телефоне остаётся один плюс, подпись — для экранного диктора.
              <Link
                to="/events/new"
                className="inline-flex min-h-[var(--control-height)] items-stretch overflow-hidden rounded-md border-2 border-ink bg-surface text-sm font-semibold text-ink no-underline shadow-sm transition-[translate,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:text-ink hover:shadow-md active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <span className="inline-flex w-11 items-center justify-center bg-accent sm:border-r-2 sm:border-ink">
                  <Icon name="plus" />
                </span>
                <span className="inline-flex items-center px-4 whitespace-nowrap max-sm:sr-only">
                  Создать встречу
                </span>
              </Link>
            )}
          </div>
        </div>
        <HeaderTrack navRef={navRef} />
      </header>

      {/* relative: спортсмен над подвалом стоит у нижнего правого края содержимого. */}
      <main className="page-container relative flex-1 py-6">
        <SportIllustration />
        <Outlet />
      </main>

      <Footer />
      <TabBar />
    </div>
  );
}
