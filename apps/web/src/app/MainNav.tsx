// Основная навигация в шапке. Владелец: участник 3; пункты своих зон участники добавляют сюда
// одной строкой. roles — кому показывать (не задано — всем, включая гостей).
import type { UserRole } from '@sport/shared';
import { NavLink } from 'react-router';
import { useMe } from '../modules/auth/api';

const ITEMS: { to: string; label: string; roles?: UserRole[] }[] = [
  { to: '/map', label: 'Карта встреч' },
  { to: '/organizations', label: 'Организации' },
  { to: '/me/events', label: 'Мои мероприятия', roles: ['user', 'organization'] },
  { to: '/org', label: 'Кабинет организации', roles: ['organization'] },
  { to: '/me/profile', label: 'Профиль', roles: ['user'] },
  { to: '/admin', label: 'Админка', roles: ['admin'] },
];

export function MainNav() {
  const me = useMe();
  const role = me.data?.role;
  const items = ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));
  if (!items.length) return null;

  return (
    <nav aria-label="Основная навигация" className="flex flex-wrap gap-6 font-semibold">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `inline-flex min-h-[var(--control-height)] items-center no-underline ${isActive ? 'shadow-[inset_0_-3px_0_var(--color-accent)]' : ''}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
