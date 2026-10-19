// Маршруты приложения. Владелец: участник 3.
// Каждая зона держит свои маршруты в modules/<зона>/routes.tsx, этот файл их только собирает.
import { createBrowserRouter } from 'react-router';
import { adminRoutes } from '../modules/admin/routes';
import { authRoutes } from '../modules/auth/routes';
import { orgRoutes } from '../modules/org/routes';
import { userRoutes } from '../modules/user/routes';
import { ErrorPage } from './ErrorPage';
import { Layout } from './Layout';
import { NotFoundPage } from './NotFoundPage';
import { StartPage } from './StartPage';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      // Временная главная: участник 1 заменяет её лентой (задача 1.4) в userRoutes и убирает отсюда.
      { index: true, element: <StartPage /> },
      ...userRoutes,
      ...orgRoutes,
      ...adminRoutes,
      ...authRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
