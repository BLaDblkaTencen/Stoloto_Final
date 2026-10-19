// Вход и регистрация: проверка полей одна и та же на сервере и в форме. Владелец: участник 3.
import { z } from 'zod';
import type { UserRole } from '../enums';

const email = z.string().trim().toLowerCase().pipe(z.email('Введите email, например ivan@mail.ru'));

export const loginBody = z.object({
  email,
  password: z.string().min(1, 'Введите пароль').max(128, 'Пароль слишком длинный'),
});

export const registerBody = z.object({
  name: z.string().trim().min(1, 'Введите имя').max(80, 'Имя должно быть не длиннее 80 символов'),
  email,
  password: z
    .string()
    .min(8, 'Пароль должен быть не короче 8 символов')
    .max(128, 'Пароль должен быть не длиннее 128 символов'),
  // Роль admin регистрацией получить нельзя: администратора создаёт только сид.
  role: z.enum(['user', 'organization'], 'Выберите тип аккаунта'),
});

export type LoginBody = z.infer<typeof loginBody>;
export type RegisterBody = z.infer<typeof registerBody>;

/** Вошедший пользователь, как его отдаёт API. */
export type AuthUser = { id: string; role: UserRole; name: string; email: string };

/** Ответ /api/auth/me, /login и /register. */
export type AuthResponse = { user: AuthUser | null };
