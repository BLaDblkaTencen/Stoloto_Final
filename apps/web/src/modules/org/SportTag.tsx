// Подпись вида спорта без нажатия: цвет и иконка как у чипов ленты и меток на карте.
import { Icon, sportColor, sportIcon } from '../../shared/ui';

export function SportTag({ sport }: { sport: { name: string; slug: string } }) {
  return (
    <span
      style={{ background: sportColor(sport.slug) }}
      className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-semibold"
    >
      <Icon name={sportIcon(sport.slug)} size={16} />
      {sport.name}
    </span>
  );
}
