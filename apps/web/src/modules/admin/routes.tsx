// Маршруты зоны «Админ»: допуск организаций, модерация мероприятий и комментариев.
// Владелец: участник 3. Доступ закрыт и в интерфейсе (RequireAuth), и на сервере (requireRole).
import { Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { AdminLayout } from './AdminLayout';
import { EventPage } from './EventPage';
import { EventsPage } from './EventsPage';
import { OrganizationPage } from './OrganizationPage';
import { OrganizationsPage } from './OrganizationsPage';

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    element: (
      <RequireAuth roles={['admin']}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="organizations" replace /> },
      { path: 'organizations', element: <OrganizationsPage /> },
      { path: 'organizations/:id', element: <OrganizationPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: 'events/:id', element: <EventPage /> },
    ],
  },
];
