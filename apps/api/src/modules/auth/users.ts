// Пользователи для входа и регистрации. Владелец: участник 3.
import type { RegisterBody } from '@sport/shared/schemas/auth';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import type { SessionUser } from './session';

/** Создать пользователя; роль приходит уже проверенной (user или organization). */
export async function createUser(
  data: Omit<RegisterBody, 'password'> & { passwordHash: string },
): Promise<SessionUser> {
  const [user] = await db
    .insert(users)
    .values(data)
    .returning({ id: users.id, role: users.role, name: users.name, email: users.email });
  return user!;
}

/** Пользователь с хэшем пароля по email без учёта регистра (как в уникальном индексе). */
export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  return user;
}
