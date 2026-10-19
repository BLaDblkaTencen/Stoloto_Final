// Хэширование паролей. Владелец: участник 3 (auth).
// @node-rs/argon2 по умолчанию использует Argon2id с рекомендуемыми параметрами.
import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Повреждённый или чужой формат хэша — считаем, что пароль не подошёл.
    return false;
  }
}
