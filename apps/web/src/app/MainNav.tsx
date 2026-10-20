// Основная навигация. Владелец: участник 3; пункты своих зон участники добавляют сюда
// одной строкой. roles — кому показывать (не задано — всем, включая гостей).
// С ширины xl меню стоит в шапке (MainNav), уже — вкладками внизу экрана (TabBar). Открытый
// раздел отмечает жёлтый участок беговой дорожки (RunningTrack.tsx).
import type { UserRole } from '@sport/shared';
import type { Ref } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';
import { useMe } from '../modules/auth/api';
import { Icon, type IconName } from '../shared/ui';
import { TabTrack } from './RunningTrack';

// to может зависеть от вошедшего: «Профиль» ведёт на его страницу /users/:id.
// short — подпись вкладки на телефоне, где на пункт меньше 90px. narrow — подпись в шапке
// уже 2xl, если полная не помещается в одну строку с именем и кнопками.
const ITEMS: {
  to: string | ((userId: string) => string);
  label: string;
  short: string;
  narrow?: string;
  icon: IconName;
  roles?: UserRole[];
}[] = [
  { to: '/', label: 'Встречи', short: 'Встречи', icon: 'calendar' },
  { to: '/organizations', label: 'Организации', short: 'Клубы', icon: 'people' },
  {
    to: '/me/events',
    label: 'Мои мероприятия',
    short: 'Мои',
    icon: 'ticket',
    roles: ['user', 'organization'],
  },
  {
    to: '/org',
    label: 'Кабинет организации',
    short: 'Кабинет',
    narrow: 'Кабинет',
    icon: 'flag',
    roles: ['organization'],
  },
  {
    to: (userId) => `/users/${userId}`,
    label: 'Профиль',
    short: 'Профиль',
    icon: 'user',
    roles: ['user'],
  },
  { to: '/admin', label: 'Админка', short: 'Админка', icon: 'shield', roles: ['admin'] },
];

function useNavItems() {
  const me = useMe();
  const role = me.data?.role;
  return ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role))).map((item) => ({
    ...item,
    to: typeof item.to === 'function' ? item.to(me.data?.id ?? '') : item.to,
  }));
}

/** Меню в шапке, с ширины xl. ref — для беговой дорожки под шапкой. */
export function MainNav({ ref }: { ref?: Ref<HTMLElement> }) {
  const items = useNavItems();
  return (
    <nav
      ref={ref}
      aria-label="Основная навигация"
      className="flex gap-6 font-semibold max-xl:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.to === '/'}
          className="inline-flex min-h-[var(--control-height)] items-center whitespace-nowrap no-underline hover:no-underline"
        >
          {item.narrow ? (
            <>
              <span className="2xl:hidden">{item.narrow}</span>
              <span className="max-2xl:hidden">{item.label}</span>
            </>
          ) : (
            item.label
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/** Вкладки внизу экрана уже xl: до них легко дотянуться большим пальцем. */
export function TabBar() {
  const items = useNavItems();
  const { pathname } = useLocation();
  const active = items.findIndex((item) =>
    matchPath({ path: item.to, end: item.to === '/' }, pathname),
  );

  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-[1100] bg-surface pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      <TabTrack index={active} count={items.length} />
      <div className="grid auto-cols-fr grid-flow-col">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-sm leading-tight font-semibold no-underline hover:text-ink hover:no-underline ${isActive ? 'text-ink' : 'text-ink-muted'}`
            }
          >
            <Icon name={item.icon} size={22} />
            {item.short}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
