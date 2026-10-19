// Маршруты приложения. Владелец: участник 3.
// Каждая зона держит свои маршруты в modules/<зона>/routes.tsx, этот файл их только собирает.
import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { adminRoutes } from '../modules/admin/routes';
import { authRoutes } from '../modules/auth/routes';
import { orgRoutes } from '../modules/org/routes';
import { userRoutes } from '../modules/user/routes';
import { ErrorPage } from './ErrorPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';

// Витрина компонентов только в режиме разработки: в сборке условие ложно, и Vite выкидывает
// страницу вместе с импортом.
const devRoutes: RouteObject[] = [];
if (import.meta.env.DEV) {
  const UiKitPage = lazy(() => import('./UiKitPage').then((m) => ({ default: m.UiKitPage })));
  devRoutes.push({
    path: 'ui',
    element: (
      <Suspense>
        <UiKitPage />
      </Suspense>
    ),
  });
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      // Главная — лента мероприятий (задача 1.4), она в userRoutes.
      ...userRoutes,
      ...orgRoutes,
      ...adminRoutes,
      ...authRoutes,
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
