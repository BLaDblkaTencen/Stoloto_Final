// Логотип «вместе» — ссылка на главную. Общий для шапки и подвала.
import { Link } from 'react-router';

export function Logo() {
  return (
    // Логотип не перекрашивается при наведении, как обычные ссылки (a:hover в index.css).
    <Link
      to="/"
      className="flex items-center gap-2.5 no-underline hover:text-ink hover:no-underline"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-11 items-center justify-center rounded-[14px] border-2 border-ink bg-accent font-display text-[22px] font-bold shadow-sm"
      >
        в
      </span>
      <span className="font-display text-[26px] font-bold">вместе</span>
    </Link>
  );
}
