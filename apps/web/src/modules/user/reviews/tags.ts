// Иконки тегов отзыва: в окне отзыва и в отметках участников тег выглядит как чип с иконкой.
import type { ReviewTag } from '@sport/shared/schemas/reviews';
import type { IconName } from '../../../shared/ui';

export const REVIEW_TAG_ICONS: Record<ReviewTag, IconName> = {
  as_described: 'check',
  started_on_time: 'clock',
  newbie_friendly: 'sprout',
  friendly: 'smile',
  want_more: 'repeat',
  comes_on_time: 'clock',
  team_player: 'people',
  helps_others: 'heart',
  keeps_word: 'check',
};
