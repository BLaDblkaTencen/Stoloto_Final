// Кнопки в стиле «Вместе»: обводка, жёсткая тень, при наведении приподнимается, при нажатии
// «вдавливается». Высота не меньше 48px. Ссылку, которая выглядит как кнопка, делает ButtonLink.
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'dark' | 'secondary' | 'danger';
type Size = 'md' | 'lg';

// Тень — у каждого варианта своя, а не общим классом: два класса тени спорили бы между собой.
const INK_SHADOW = 'shadow-sm hover:shadow-md disabled:shadow-sm';

const VARIANTS: Record<Variant, string> = {
  // hover:text-* — иначе общее правило a:hover перекрасит текст ссылки-кнопки.
  primary: `bg-primary text-primary-ink hover:text-primary-ink ${INK_SHADOW}`,
  // Чёрную тень на тёмной кнопке не видно, поэтому у неё тень цвета акцента, как в макете главной.
  dark: 'bg-ink text-white hover:text-white shadow-[2px_2px_0_var(--color-accent)] hover:shadow-[4px_4px_0_var(--color-accent)] disabled:shadow-[2px_2px_0_var(--color-accent)]',
  secondary: `bg-surface text-ink hover:text-ink ${INK_SHADOW}`,
  danger: `bg-danger text-danger-ink hover:text-danger-ink ${INK_SHADOW}`,
};

const SIZES: Record<Size, string> = {
  md: 'min-h-[var(--control-height)] px-5 text-sm',
  lg: 'min-h-[var(--control-height-lg)] px-[26px] text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return [
    'inline-flex items-center justify-center gap-2 rounded-md border-2 border-ink font-semibold',
    'no-underline transition-[translate,box-shadow] duration-100 cursor-pointer',
    'hover:-translate-x-px hover:-translate-y-px',
    'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-none',
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** Идёт запрос: кнопка недоступна и сообщает об этом экранному диктору. */
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = LinkProps & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className = '', ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
