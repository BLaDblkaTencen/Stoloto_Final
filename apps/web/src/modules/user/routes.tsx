// Маршруты зоны «Пользователь»: лента, карточка события, создание, «Мои мероприятия», профиль.
// Владелец: участник 1. Страницы и компоненты зоны лежат в этой папке; общие — в shared/ui.
import type { RouteObject } from 'react-router';
import { EventPage } from './EventPage';
import { FeedPage } from './FeedPage';

export const userRoutes: RouteObject[] = [
  { index: true, element: <FeedPage /> },
  { path: 'events/:id', element: <EventPage /> },
];
