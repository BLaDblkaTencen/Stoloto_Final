// Организации. Владелец: участник 2. Формы запросов и ответов для сервера и интерфейса.
// Подписи статусов заявки — ORG_STATUS_LABELS в корне @sport/shared (labels.ts).
import { z } from 'zod';
import type { OrgStatus } from '../enums';
import { sportNameSchema, sportSlug } from './sports';

/** Видов спорта у организации: из списка и своих вариантов вместе. */
export const ORG_SPORTS_MAX = 10;

/** Название без лишних пробелов; регистр сохраняется. */
export const normalizeOrgName = (name: string) => name.trim().replace(/\s+/g, ' ');

/** Необязательный текст: пустая строка превращается в null (поле очищено). */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: не длиннее ${max} символов`)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const organizationFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Название: от 2 символов')
    .max(100, 'Название: не длиннее 100 символов')
    .transform(normalizeOrgName),
  description: z
    .string()
    .trim()
    .min(10, 'Опишите деятельность подробнее: от 10 символов')
    .max(1000, 'Описание: не длиннее 1000 символов'),
  activity: z
    .string()
    .trim()
    .min(2, 'Укажите вид объединения: клуб, кружок, федерация…')
    .max(100, 'Вид объединения: не длиннее 100 символов'),
  city: optionalText(80, 'Город'),
  contacts: optionalText(300, 'Контакты'),
  /** Из списка; может быть пустым, если есть свои варианты. */
  sportIds: z
    .array(z.uuid('Неверный вид спорта'))
    .max(ORG_SPORTS_MAX, `Не больше ${ORG_SPORTS_MAX} видов спорта`)
    .transform((ids) => [...new Set(ids)]),
  /**
   * Свои варианты, которых нет в списке (ТЗ: «список + свой вариант»). Сервер находит вид спорта
   * с тем же ключом или добавляет новый в каталог — как sportName у события. Из дублей по ключу
   * остаётся первый: «Петанк» и «петанк!» дают «Петанк».
   */
  sportNames: z
    .array(sportNameSchema)
    .max(ORG_SPORTS_MAX, `Не больше ${ORG_SPORTS_MAX} видов спорта`)
    .transform((names) =>
      names.filter(
        (name, i) => names.findIndex((other) => sportSlug(other) === sportSlug(name)) === i,
      ),
    )
    .optional(),
};

type SportsPart = { sportIds?: string[]; sportNames?: string[] };
const sportsCount = (body: SportsPart) =>
  (body.sportIds?.length ?? 0) + (body.sportNames?.length ?? 0);

// Проверки по двум полям сразу. when: ошибка о видах спорта видна, даже если неверно другое
// поле (например название), — форма подсвечивает всё за один раз.
const sportsShape = z.object({
  sportIds: organizationFields.sportIds.optional(),
  sportNames: organizationFields.sportNames,
});
const sportsValid = {
  when: ({ value }: { value: unknown }) => sportsShape.safeParse(value).success,
};
const atLeastOneSport = {
  ...sportsValid,
  path: ['sportIds'],
  message: 'Выберите хотя бы один вид спорта',
};
const notTooManySports = {
  ...sportsValid,
  path: ['sportIds'],
  message: `Не больше ${ORG_SPORTS_MAX} видов спорта`,
};

/** POST /api/organizations */
export const createOrganizationBody = z
  .object(organizationFields)
  .refine((body) => sportsCount(body) >= 1, atLeastOneSport)
  .refine((body) => sportsCount(body) <= ORG_SPORTS_MAX, notTooManySports);
export type CreateOrganizationBody = z.output<typeof createOrganizationBody>;

/**
 * PATCH /api/organizations/me: любые поля частично, статус не меняется. Виды спорта заменяются
 * целиком, поэтому sportNames — только вместе с sportIds (пустой список, если все свои).
 */
export const updateOrganizationBody = z
  .object(organizationFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), 'Нет изменений')
  .refine((body) => body.sportNames === undefined || body.sportIds !== undefined, {
    ...sportsValid,
    path: ['sportNames'],
    message: 'Свои виды спорта присылаются вместе со списком sportIds',
  })
  .refine((body) => body.sportIds === undefined || sportsCount(body) >= 1, atLeastOneSport)
  .refine((body) => sportsCount(body) <= ORG_SPORTS_MAX, notTooManySports);
export type UpdateOrganizationBody = z.output<typeof updateOrganizationBody>;

/** GET /api/organizations */
export const organizationListQuery = z.object({
  q: z.string().trim().max(100, 'Запрос: не длиннее 100 символов').optional(),
  sportId: z.uuid('Неверный вид спорта').optional(),
  city: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type OrganizationListQuery = z.output<typeof organizationListQuery>;

export type SportRef = { id: string; name: string; slug: string };

/** Публичный вид допущенной организации. */
export type OrganizationPublic = {
  id: string;
  name: string;
  description: string;
  activity: string;
  city: string | null;
  contacts: string | null;
  sports: SportRef[];
  createdAt: string;
};

/** Вид для владельца и администратора: со статусом заявки. */
export type OrganizationOwner = OrganizationPublic & {
  ownerId: string;
  status: OrgStatus;
  /** Есть только у отклонённой заявки. */
  rejectionReason: string | null;
  reviewedAt: string | null;
};

/** GET /api/organizations/:id: вид зависит от того, кто смотрит. */
export type OrganizationView =
  ({ view: 'public' } & OrganizationPublic) | ({ view: 'owner' } & OrganizationOwner);
