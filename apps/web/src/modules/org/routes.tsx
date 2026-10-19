// Маршруты зоны «Организация»: заявка, кабинет, страница организации, панель организатора, карта.
// Владелец: участник 2. Страницы и компоненты зоны лежат в этой папке; общие — в shared/ui.
// Страницы грузятся лениво: их код (а позже и карта Leaflet) не попадает в первый экран сайта.
import type { RouteObject } from 'react-router';

export const orgRoutes: RouteObject[] = [
  {
    path: 'org',
    lazy: async () => ({ Component: (await import('./OrgCabinetPage')).OrgCabinetRoute }),
  },
  {
    path: 'organizations',
    lazy: async () => ({ Component: (await import('./OrganizationsPage')).OrganizationsPage }),
  },
  {
    path: 'map',
    lazy: async () => ({ Component: (await import('./map/MapPage')).MapPage }),
  },
  {
    path: 'organizations/:id',
    lazy: async () => ({ Component: (await import('./OrganizationPage')).OrganizationPage }),
  },
];
