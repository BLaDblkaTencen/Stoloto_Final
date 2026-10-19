// Кнопки в стиле «Вместе»: обводка, жёсткая тень, при наведении приподнимается, при нажатии
// «вдавливается». Высота не меньше 48px. Ссылку, которая выглядит как кнопка, делает ButtonLink.
import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'dark' | 'secondary' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // hover:text-* — иначе общее правило a:hover перекрасит текст ссылки-кнопки.
  primary: 'bg-primary text-primary-ink hover:text-primary-ink',
  dark: 'bg-ink text-white hover:text-white',
  secondary: 'bg-surface text-ink hover:text-ink',
  danger: 'bg-danger text-danger-ink hover:text-danger-ink',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-[var(--control-height)] px-5 text-sm',
  lg: 'min-h-[var(--control-height-lg)] px-[26px] text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return [
    'inline-flex items-center justify-center gap-2 rounded-md border-2 border-ink font-semibold',
    'no-underline shadow-sm transition-[translate,box-shadow] duration-100 cursor-pointer',
    'hover:-translate-x-px hover:-translate-y-px hover:shadow-md',
    'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-none disabled:shadow-sm',
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
