// Подписи для интерфейса. Совпадают с docs/DATA_MODEL.md.
import type { UserRole } from './enums';

export const ROLE_LABELS: Record<UserRole, string> = {
  user: 'Участник',
  organization: 'Организация',
  admin: 'Администратор',
};
