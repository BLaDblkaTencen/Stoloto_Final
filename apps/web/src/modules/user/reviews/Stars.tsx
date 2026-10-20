// Звёзды отзыва: выбор оценки (группа радиокнопок) и показ готовой оценки.
// Жёлтая заливка с чёрной обводкой — как тени и акценты остального интерфейса.
import { useRef, useState, type KeyboardEvent } from 'react';

const STAR_PATH = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';
const VALUES = [1, 2, 3, 4, 5] as const;

const ratingFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 4.8 → «4,8». */
export const formatRating = (rating: number) => ratingFormat.format(rating);

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d={STAR_PATH}
        strokeWidth={size < 24 ? 2.4 : 1.8}
        strokeLinejoin="round"
        className={`stroke-ink transition-[fill] duration-100 ${filled ? 'fill-accent' : 'fill-surface'}`}
      />
    </svg>
  );
}

/**
 * Выбор оценки от 1 до 5. Клавиатура: стрелки меняют оценку, как в обычной группе радиокнопок;
 * в порядке Tab стоит одна звезда — выбранная или первая.
 */
export function StarsInput({
  value,
  onChange,
  label,
  size = 36,
  className = '',
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: number;
  className?: string;
}) {
  // Кнопка не меньше 48px (DESIGN_BRIEF), а у крупных звёзд — с запасом под наклон при наведении.
  const button = Math.max(48, size + 12);
  const [hover, setHover] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;

  const onKeyDown = (event: KeyboardEvent, current: number) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = Math.min(5, Math.max(1, current + step));
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex flex-wrap ${className}`}
      onMouseLeave={() => setHover(0)}
    >
      {VALUES.map((n) => (
        <button
          key={n}
          ref={(node) => {
            refs.current[n - 1] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} из 5`}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onKeyDown={(event) => onKeyDown(event, n)}
          style={{ width: button, height: button }}
          className="inline-flex cursor-pointer items-center justify-center rounded-md transition-[translate,rotate] duration-100 hover:-translate-y-0.5 hover:-rotate-6"
        >
          <Star filled={n <= shown} size={size} />
        </button>
      ))}
    </div>
  );
}

/** Готовая оценка: звёзды по округлённому значению, точное число — для экранного диктора. */
export function Stars({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <span role="img" aria-label={`Оценка ${formatRating(rating)} из 5`} className="inline-flex">
      {VALUES.map((n) => (
        <Star key={n} filled={n <= Math.round(rating)} size={size} />
      ))}
    </span>
  );
}
