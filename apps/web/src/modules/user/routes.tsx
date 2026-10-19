// Маршруты зоны «Пользователь»: лента, карточка события, создание, «Мои мероприятия», профиль.
// Владелец: участник 1. Страницы и компоненты зоны лежат в этой папке; общие — в shared/ui.
// Лента и карточка — в основном бандле (с них начинают), формы и кабинеты грузятся по требованию.
import type { RouteObject } from 'react-router';
import { EventPage } from './EventPage';
import { FeedPage } from './FeedPage';

export const userRoutes: RouteObject[] = [
  { index: true, element: <FeedPage /> },
  {
    path: 'events/new',
    lazy: async () => ({ Component: (await import('./EventFormPage')).CreateEventRoute }),
  },
  { path: 'events/:id', element: <EventPage /> },
  {
    path: 'events/:id/edit',
    lazy: async () => ({ Component: (await import('./EventFormPage')).EditEventRoute }),
  },
  {
    path: 'me/events',
    lazy: async () => ({ Component: (await import('./MyEventsPage')).MyEventsRoute }),
  },
  {
    path: 'me/profile',
    lazy: async () => ({ Component: (await import('./ProfilePage')).EditProfileRoute }),
  },
  {
    path: 'users/:id',
    lazy: async () => ({ Component: (await import('./ProfilePage')).ProfilePage }),
  },
];
