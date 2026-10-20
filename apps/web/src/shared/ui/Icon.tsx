// Иконки интерфейса: линейные, 24×24, цвет — currentColor. Контуры видов спорта, замка и двери
// взяты из макета docs/design/home.html, чтобы метки на карте и чипы совпадали с ним.
// Иконка всегда декоративная (aria-hidden): смысл передаёт подпись рядом.

export const ICON_PATHS = {
  // статусы
  check: 'M5 12l5 5L20 7',
  clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0 -16M12 8v4l3 2',
  cross: 'M7 7l10 10M17 7L7 17',
  eyeOff:
    'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.4 9.4 0 0 1 12 5c4.4 0 7.9 3.4 9 7a11 11 0 0 1 -2.4 3.6M6.6 6.6C4.8 7.9 3.6 9.8 3 12c1.1 3.6 4.6 7 9 7a9 9 0 0 0 4.9 -1.4',
  door: 'M14 12v.01M3 21h18M6 21V5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16',
  lock: 'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2zM8 11V8a4 4 0 0 1 8 0v3',
  alert: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0 -16M12 8v5M12 16v.01',
  // общие
  all: 'M4 4h6v6h-6zM14 4h6v6h-6zM4 14h6v6h-6zM14 14h6v6h-6z',
  plus: 'M12 5v14M5 12h14',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zM12 7.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0 -4.4',
  calendar:
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16',
  people:
    'M9 7a3 3 0 1 0 0 6a3 3 0 1 0 0 -6M3 21v-1a5 5 0 0 1 5 -5h2a5 5 0 0 1 5 5v1M16 4.1a3 3 0 0 1 0 5.8M21 21v-1a5 5 0 0 0 -3 -4.6',
  search: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0 -12M21 21l-6.5 -6.5',
  close: 'M6 6l12 12M18 6L6 18',
  chevronDown: 'M6 9l6 6l6 -6',
  arrowRight: 'M5 12h14M13 6l6 6l-6 6',
  // виды спорта
  run: 'M13 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 17l5 1l.75 -1.5M15 21v-4l-4 -3l1 -6M7 12v-3l5 -1l3 3l3 1',
  ball: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0 -18M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55zM12 7v-4M16.76 10.45l3.24 -1.45M15 16l2.5 3M9 16l-2.5 3M7.24 10.45l-3.24 -1.45',
  chess:
    'M12 3a3 3 0 0 0 -1.3 5.7l-1.7 6.3h6l-1.7 -6.3a3 3 0 0 0 -1.3 -5.7M8 15h8M7 21h10l-1 -3h-8z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0 -8M3 12h1M12 3v1M20 12h1M12 20v1M5.6 5.6l.7 .7M18.4 5.6l-.7 .7M17.7 17.7l.7 .7M6.3 17.7l-.7 .7',
  mount: 'M3 20l6 -11l4 6l3 -4l5 9zM9 9l1.5 3',
  yoga: 'M12 3a2 2 0 1 0 0 4a2 2 0 1 0 0 -4M4 20h16M5 11l7 2l7 -2M12 13v4l-3 3M12 17l3 3',
  wave: 'M3 16c2 0 2 -2 4.5 -2s2.5 2 4.5 2s2 -2 4.5 -2s2.5 2 4.5 2M3 20c2 0 2 -2 4.5 -2s2.5 2 4.5 2s2 -2 4.5 -2s2.5 2 4.5 2M9 11l3 -6l4 3',
  bike: 'M5 19a3 3 0 1 0 0 -6a3 3 0 1 0 0 6M19 19a3 3 0 1 0 0 -6a3 3 0 1 0 0 6M12 19v-4l-3 -3l4 -3l2 3h3M16 6a1 1 0 1 0 0 -2a1 1 0 1 0 0 2',
  activity: 'M3 12h4l3 8l4 -16l3 8h4',
  // типы площадок (DATA_MODEL.md, «Типы площадок: подписи и иконки»)
  cup: 'M4 9h12v5a5 5 0 0 1 -5 5h-2a5 5 0 0 1 -5 -5zM16 10h1.5a2.5 2.5 0 0 1 0 5h-1.5M8 3v3M12 3v3',
  house: 'M4 11l8 -7l8 7M6 9.5v10.5h12v-10.5M10 20v-5h4v5',
  field:
    'M3 6h18v12h-18zM12 6v12M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0 -5M3 9.5h2.5v5h-2.5M21 9.5h-2.5v5h2.5',
  dumbbell: 'M3 10v4M6 7.5v9M18 7.5v9M21 10v4M6 12h12',
  waves:
    'M3 8c2 0 2 -2 4.5 -2s2.5 2 4.5 2s2 -2 4.5 -2s2.5 2 4.5 2M3 13c2 0 2 -2 4.5 -2s2.5 2 4.5 2s2 -2 4.5 -2s2.5 2 4.5 2M3 18c2 0 2 -2 4.5 -2s2.5 2 4.5 2s2 -2 4.5 -2s2.5 2 4.5 2',
  tree: 'M12 21v-5M8 16h8a4 4 0 0 0 1.5 -7.7a5.5 5.5 0 0 0 -11 0a4 4 0 0 0 1.5 7.7z',
  yard: 'M2 20h20M3 20v-8l5 -4l5 4v8M6.5 20v-4h3v4M18 20v-4M18 16a3 3 0 1 0 0 -6a3 3 0 1 0 0 6',
  dot: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0 -8',
  map: 'M9 4l-6 2v14l6 -2l6 2l6 -2v-14l-6 2l-6 -2zM9 4v14M15 6v14',
  phone:
    'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 2.4,
  className = '',
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
