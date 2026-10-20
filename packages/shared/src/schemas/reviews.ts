// Отзывы после встречи: проверка запросов и типы ответов API. Владелец: участник 1.
// Участник оценивает организатора (человека или клуб), организатор отмечает, кто пришёл.
// Из этих отметок складываются оценка и надёжность в профиле. Контракт — docs/api/events.md, «Отзывы».
import { z } from 'zod';

export const REVIEW_DIRECTIONS = ['participant_to_organizer', 'organizer_to_participant'] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

/** Сколько дней после окончания встречи можно оставить и поправить отзыв. */
export const REVIEW_WINDOW_DAYS = 14;
/** Средняя оценка видна от стольких отзывов: одна оценка не должна решать за человека. */
export const RATING_MIN_REVIEWS = 3;
export const REVIEW_COMMENT_MAX = 500;

// Подписи без рода: подходят и человеку, и клубу, и любому участнику.
export const ORGANIZER_TAGS = [
  'as_described',
  'started_on_time',
  'newbie_friendly',
  'friendly',
  'want_more',
] as const;
export const PARTICIPANT_TAGS = [
  'comes_on_time',
  'team_player',
  'helps_others',
  'keeps_word',
] as const;
export type OrganizerTag = (typeof ORGANIZER_TAGS)[number];
export type ParticipantTag = (typeof PARTICIPANT_TAGS)[number];
export type ReviewTag = OrganizerTag | ParticipantTag;

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  as_described: 'Всё как в описании',
  started_on_time: 'Начали вовремя',
  newbie_friendly: 'Рады новичкам',
  friendly: 'Дружелюбная атмосфера',
  want_more: 'Хочу ещё',
  comes_on_time: 'Приходит вовремя',
  team_player: 'Играет в команду',
  helps_others: 'Помогает другим',
  keeps_word: 'Держит слово',
};

const rating = z
  .number({ error: 'Поставьте оценку от 1 до 5' })
  .int('Оценка — целое число от 1 до 5')
  .min(1, 'Оценка — от 1 до 5')
  .max(5, 'Оценка — от 1 до 5');

/** Необязательный комментарий: пустая строка из формы превращается в null. */
const comment = z
  .string()
  .trim()
  .max(REVIEW_COMMENT_MAX, `Комментарий — не длиннее ${REVIEW_COMMENT_MAX} символов`)
  .nullish()
  .transform((value) => (value ? value : null));

const tagsOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values, 'Неизвестный тег'))
    .default([])
    .transform((tags) => [...new Set(tags)]);

/** Отзыв участника об организаторе: звёзды обязательны, остальное по желанию. */
export const participantReviewSchema = z.object({
  rating,
  tags: tagsOf(ORGANIZER_TAGS),
  comment,
});

export type ParticipantReviewInput = z.input<typeof participantReviewSchema>;
export type ParticipantReviewData = z.output<typeof participantReviewSchema>;

/**
 * Отметки организатора. Главное — пришёл ли человек; звёзды и теги только тому, кто пришёл:
 * у неявки они теряют смысл, поэтому сервер их отбрасывает.
 */
export const attendanceSchema = z.object({
  marks: z
    .array(
      z
        .object({
          userId: z.uuid('Неверный участник'),
          attended: z.boolean('Отметьте, был ли человек на встрече'),
          rating: rating.nullish().transform((value) => value ?? null),
          tags: tagsOf(PARTICIPANT_TAGS),
          comment,
        })
        .transform((mark) => (mark.attended ? mark : { ...mark, rating: null, tags: [] })),
    )
    .min(1, 'Отметьте хотя бы одного участника')
    .refine(
      (marks) => new Set(marks.map((mark) => mark.userId)).size === marks.length,
      'Участник отмечен дважды',
    ),
});

export type AttendanceInput = z.input<typeof attendanceSchema>;
export type AttendanceData = z.output<typeof attendanceSchema>;

// ---------- Ответы ----------

/** Средняя оценка: null, пока отзывов меньше RATING_MIN_REVIEWS («Новый организатор»). */
export type RatingSummary = { rating: number | null; count: number };

/** Надёжность участника: пришёл на attended встреч из total, где был записан. */
export type Reliability = { attended: number; total: number };

export type ParticipantSummary = RatingSummary & Reliability;

/** Организатор: оценка участников и число проведённых встреч. */
export type OrganizerSummary = RatingSummary & { organized: number };

/** Кто оставил отзыв: за клуб отмечает его аккаунт, но подписываем названием клуба. */
export type ReviewAuthor = { type: 'user' | 'organization'; id: string; name: string };

export type Review = {
  id: string;
  direction: ReviewDirection;
  rating: number | null;
  tags: ReviewTag[];
  comment: string | null;
  /** Только у отметки организатора. */
  attended: boolean | null;
  createdAt: string;
  author: ReviewAuthor;
  event: { id: string; title: string; startsAt: string };
};

/** GET /users/:id/reviews: отзывы о человеке как об организаторе и как об участнике. */
export type UserReviews = {
  asOrganizer: OrganizerSummary;
  asParticipant: ParticipantSummary;
  items: Review[];
};

/** GET /organizations/:id/reviews. */
export type OrganizationReviews = { summary: OrganizerSummary; items: Review[] };

/** Мой отзыв о встрече: можно поправить, пока окно открыто. */
export type MyReview = {
  rating: number;
  tags: OrganizerTag[];
  comment: string | null;
  updatedAt: string;
};

/** Отзыв о прошедшей встрече в «Мои записи»: можно ли оставить сейчас и что уже оставлено. */
export type ReviewState = { open: boolean; closesAt: string; mine: MyReview | null };

/** Отметки участников прошедшей встречи в «Я организую». */
export type AttendanceState = { open: boolean; closesAt: string; marked: boolean };

export type AttendanceItem = {
  user: { id: string; name: string };
  /** Ещё не отмечен — считается пришедшим. */
  marked: boolean;
  attended: boolean;
  rating: number | null;
  tags: ParticipantTag[];
  comment: string | null;
};

/** GET /events/:id/attendance: подтверждённые участники с отметками организатора. */
export type Attendance = { open: boolean; closesAt: string; items: AttendanceItem[] };
