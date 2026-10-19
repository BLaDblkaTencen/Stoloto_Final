// Чип-фильтр: кнопка-переключатель (aria-pressed). Выбранный чип заливается цветом, получает
// тень и чуть поворачивается — «игривость» из макета; карточки и формы не поворачиваем.
import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { sportColor, sportIcon } from './sport';

// Повороты выбранных чипов по порядку, как в макете: соседние наклонены по-разному.
const ROTATIONS = ['0deg', '-1.5deg', '1deg', '-0.5deg', '1.5deg', '-1deg', '0.5deg', '-1deg'];

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  pressed: boolean;
  /** Цвет заливки выбранного чипа (CSS-значение). */
  color?: string;
  icon?: IconName;
  /** Позиция в ряду — от неё зависит наклон. */
  index?: number;
};

export function Chip({
  pressed,
  color = 'var(--color-accent)',
  icon,
  index = 0,
  className = '',
  style,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      style={{
        ...style,
        background: pressed ? color : undefined,
        rotate: pressed ? ROTATIONS[index % ROTATIONS.length] : undefined,
      }}
      className={[
        'inline-flex min-h-[var(--control-height)] cursor-pointer items-center gap-2 rounded-md',
        'border-2 border-ink bg-surface text-sm font-semibold transition-[translate,rotate] duration-100',
        icon ? 'pr-[18px] pl-[7px]' : 'px-[18px]',
        pressed ? '-translate-x-0.5 -translate-y-0.5 shadow-md' : 'hover:-translate-y-px',
        className,
      ].join(' ')}
      {...props}
    >
      {icon && (
        <span className="inline-flex size-[34px] items-center justify-center rounded-[11px] border-2 border-ink bg-surface">
          <Icon name={icon} size={19} />
        </span>
      )}
      {children}
    </button>
  );
}

/** Чип вида спорта: цвет и иконка по slug. */
export function SportChip({
  sport,
  ...props
}: Omit<ChipProps, 'color' | 'icon' | 'children'> & { sport: { name: string; slug: string } }) {
  return (
    <Chip color={sportColor(sport.slug)} icon={sportIcon(sport.slug)} {...props}>
      {sport.name}
    </Chip>
  );
}
