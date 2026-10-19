// Организации. Владелец: участник 2. Формы запросов и ответов для сервера и интерфейса.
import { z } from 'zod';
import type { OrgStatus } from '../enums';

/** Подписи статусов заявки из docs/DATA_MODEL.md. */
export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Допущена',
  rejected: 'Отклонена',
};

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
  sportIds: z
    .array(z.uuid('Неверный вид спорта'))
    .min(1, 'Выберите хотя бы один вид спорта')
    .max(10, 'Не больше 10 видов спорта')
    .transform((ids) => [...new Set(ids)]),
};

/** POST /api/organizations */
export const createOrganizationBody = z.object(organizationFields);
export type CreateOrganizationBody = z.output<typeof createOrganizationBody>;

/** PATCH /api/organizations/me: любые поля частично, статус не меняется. */
export const updateOrganizationBody = z
  .object(organizationFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), 'Нет изменений');
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
