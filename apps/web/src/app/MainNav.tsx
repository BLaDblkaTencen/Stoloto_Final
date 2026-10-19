// Основная навигация в шапке. Владелец: участник 3; пункты своих зон участники добавляют сюда
// одной строкой. roles — кому показывать (не задано — всем, включая гостей).
import type { UserRole } from '@sport/shared';
import { NavLink } from 'react-router';
import { useMe } from '../modules/auth/api';

// to может зависеть от вошедшего: «Профиль» ведёт на его страницу /users/:id.
const ITEMS: { to: string | ((userId: string) => string); label: string; roles?: UserRole[] }[] = [
  { to: '/', label: 'Встречи' },
  { to: '/organizations', label: 'Организации' },
  { to: '/me/events', label: 'Мои мероприятия', roles: ['user', 'organization'] },
  { to: '/org', label: 'Кабинет организации', roles: ['organization'] },
  { to: (userId) => `/users/${userId}`, label: 'Профиль', roles: ['user'] },
  { to: '/admin', label: 'Админка', roles: ['admin'] },
];

export function MainNav() {
  const me = useMe();
  const role = me.data?.role;
  const items = ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));
  if (!items.length) return null;

  return (
    <nav aria-label="Основная навигация" className="flex flex-wrap gap-6 font-semibold">
      {items.map((item) => {
        const to = typeof item.to === 'function' ? item.to(me.data?.id ?? '') : item.to;
        return (
          <NavLink
            key={item.label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `inline-flex min-h-[var(--control-height)] items-center no-underline transition-[translate,box-shadow] duration-100 hover:-translate-y-0.5 hover:no-underline hover:shadow-[inset_0_-3px_0_var(--color-accent)] ${isActive ? 'shadow-[inset_0_-3px_0_var(--color-accent)]' : ''}`
            }
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
