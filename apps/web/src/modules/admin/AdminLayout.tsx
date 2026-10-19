// Раздел администратора: вкладки «Организации» и «Мероприятия». Владелец: участник 3.
import { NavLink, Outlet } from 'react-router';

const TABS = [
  { to: '/admin/organizations', label: 'Организации' },
  { to: '/admin/events', label: 'Мероприятия' },
];

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-h2">Админка</h1>
        <nav aria-label="Разделы админки" className="flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                [
                  'inline-flex min-h-[var(--control-height)] items-center rounded-md border-2 border-ink px-5 font-semibold no-underline',
                  isActive ? 'bg-accent shadow-sm hover:text-ink' : 'bg-surface',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
