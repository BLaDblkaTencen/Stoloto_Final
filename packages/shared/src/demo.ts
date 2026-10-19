// Демо-аккаунты для кнопок «Войти как…» на экране входа. Пароль публичный, только для проверки:
// он же в docs/DEMO_DATA.md и README. Аккаунты создаёт сид (apps/api/src/db/seed).
import type { UserRole } from './enums';

export const DEMO_PASSWORD = 'demo-sport-2026';

export type DemoAccount = {
  role: UserRole;
  /** Подпись кнопки на экране входа. */
  label: string;
  name: string;
  email: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { role: 'user', label: 'Участник', name: 'Иван Петров', email: 'user1@demo.local' },
  {
    role: 'organization',
    label: 'Организация',
    name: 'Анна Смирнова',
    email: 'org.approved@demo.local',
  },
  { role: 'admin', label: 'Администратор', name: 'Администратор', email: 'admin@demo.local' },
];
