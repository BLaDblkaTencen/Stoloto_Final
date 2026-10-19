// Профиль пользователя: проверка запросов и типы ответов API. Владелец: участник 1.
// Контракт — docs/api/events.md, раздел «Профиль». Email и пароль здесь не меняются (модуль auth).
import { z } from 'zod';
import type { EventListItem } from './events';
import type { Sport } from './sports';

export const PROFILE_LIMITS = {
  name: { max: 80 },
  about: { max: 1000 },
  city: { max: 100 },
  sports: { max: 20 },
} as const;

/** Необязательный текст: пустая строка из формы превращается в null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const updateProfileSchema = z
  .object({
    name: z
      .string({ error: 'Введите имя' })
      .trim()
      .min(1, 'Введите имя')
      .max(PROFILE_LIMITS.name.max, `Имя — не длиннее ${PROFILE_LIMITS.name.max} символов`)
      .optional(),
    about: optionalText(
      PROFILE_LIMITS.about.max,
      `О себе — не длиннее ${PROFILE_LIMITS.about.max} символов`,
    ),
    city: optionalText(
      PROFILE_LIMITS.city.max,
      `Город — не длиннее ${PROFILE_LIMITS.city.max} символов`,
    ),
    sportIds: z
      .array(z.uuid('Неверный вид спорта'))
      .max(PROFILE_LIMITS.sports.max, `Не больше ${PROFILE_LIMITS.sports.max} видов спорта`)
      .transform((ids) => [...new Set(ids)])
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Нет изменений',
  });

export type ProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

export type UserProfile = {
  id: string;
  name: string;
  about: string | null;
  city: string | null;
  sports: Sport[];
  /** Ближайшие опубликованные события, которые человек организует. */
  upcomingEvents: EventListItem[];
};
