// Логотип «движ» — ссылка на главную. Общий для шапки и подвала.
// Знак — метка на карте с кругами «я здесь»: встреча рядом с вами (макет 7A «Пинг»).
import { Link } from 'react-router';

export function Logo() {
  return (
    // Логотип не перекрашивается при наведении, как обычные ссылки (a:hover в index.css).
    <Link to="/" className="flex items-center gap-2 no-underline hover:text-ink hover:no-underline">
      <LogoMark />
      <span className="font-logo text-[28px] leading-none font-bold">движ</span>
    </Link>
  );
}

/** Знак без слова: метка и круги под ней. Цвета — токены дизайна. */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={(size * 52) / 48}
      viewBox="0 0 48 52"
      className="shrink-0"
    >
      <ellipse
        cx="24"
        cy="47"
        rx="18"
        ry="4"
        fill="none"
        stroke="var(--status-request)"
        strokeWidth="2.5"
      />
      <ellipse
        cx="24"
        cy="47"
        rx="10"
        ry="2.2"
        fill="none"
        stroke="var(--status-request)"
        strokeWidth="2.5"
      />
      <path
        d="M24 46s-15-13-15-24a15 15 0 0 1 30 0c0 11-15 24-15 24z"
        fill="var(--color-accent)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="24"
        cy="21"
        r="5.5"
        fill="var(--color-surface)"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
      />
    </svg>
  );
}
