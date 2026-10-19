// Маршруты входа: вход, регистрация, демо-аккаунты (задача 3.2). Владелец: участник 3.
import type { RouteObject } from 'react-router';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

export const authRoutes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  { path: 'register', element: <RegisterPage /> },
];
