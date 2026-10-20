// Декоративный фон страниц: мягкие пятна, кольца, облака и волны за содержимым. Владелец: участник 3.
// Четыре варианта, страница получает свой по адресу (backgroundFor). Фигуры не растягиваются одной
// картинкой на весь экран, а привязаны каждая к своему краю и масштабируются от ширины окна:
// иначе на телефоне от фона осталась бы пустая середина.
import type { CSSProperties, ReactNode } from 'react';
import { useLocation } from 'react-router';

export type BackgroundVariant = 'circles' | 'hills' | 'diagonals' | 'lines';

/** Главная — без фона: там площадка вида спорта (HomeHero); создание встречи и кабинет клуба —
 *  «движение» по диагонали; встреча, клубы и карта — облака и холмы «на улице»; профиль, вход
 *  и админка — линии. Вариант «пятна и кольца» пока не используется. */
export function backgroundFor(pathname: string): BackgroundVariant | null {
  if (pathname === '/') return null;
  if (pathname === '/events/new' || pathname.endsWith('/edit')) return 'diagonals';
  if (pathname === '/org' || pathname.startsWith('/org/')) return 'diagonals';
  if (
    pathname.startsWith('/events/') ||
    pathname.startsWith('/organizations') ||
    pathname.startsWith('/map')
  ) {
    return 'hills';
  }
  return 'lines';
}

export function PageBackground() {
  const { pathname } = useLocation();
  const variant = backgroundFor(pathname);
  if (!variant) return null;
  return (
    <div
      aria-hidden="true"
      data-background={variant}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-surface/40 to-transparent"
    >
      <Gradients />
      {variant === 'circles' && <Circles />}
      {variant === 'hills' && <Hills />}
      {variant === 'diagonals' && <Diagonals />}
      {variant === 'lines' && <Lines />}
    </div>
  );
}

// Градиенты общие для всех фигур: id видны всему документу, поэтому объявлены один раз.
function Gradients() {
  const stop = (offset: number, color: string, opacity: number) => (
    <stop offset={offset} style={{ stopColor: `var(${color})`, stopOpacity: opacity }} />
  );
  return (
    <svg width="0" height="0" className="absolute">
      <defs>
        <linearGradient id="bg-blob" x1="0" y1="0" x2="1" y2="1">
          {stop(0, '--status-free', 0.6)}
          {stop(1, '--status-free', 0.25)}
        </linearGradient>
        <linearGradient id="bg-soft" x1="0" y1="0" x2="1" y2="1">
          {stop(0, '--status-free', 0.3)}
          {stop(1, '--status-free', 0.08)}
        </linearGradient>
        <linearGradient id="bg-mint" x1="0" y1="0" x2="1" y2="0">
          {stop(0, '--status-success', 0.15)}
          {stop(1, '--status-success', 0.5)}
        </linearGradient>
      </defs>
    </svg>
  );
}

function Shape({
  viewBox,
  style,
  stretch = false,
  className = '',
  children,
}: {
  viewBox: string;
  style: CSSProperties;
  /** Растянуть по заданным ширине и высоте (для волн во всю ширину экрана). */
  stretch?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={stretch ? 'none' : undefined}
      fill="none"
      className={`absolute h-auto ${className}`}
      style={style}
    >
      {children}
    </svg>
  );
}

// Тонкая линия колец и волн. non-scaling-stroke держит толщину 1.5px при любом размере фигуры.
const line = {
  className: 'stroke-primary/40',
  strokeWidth: 1.5,
  vectorEffect: 'non-scaling-stroke',
} as const;

function Ring({ style }: { style: CSSProperties }) {
  return (
    <Shape viewBox="0 0 200 200" style={style}>
      <circle cx="100" cy="100" r="98" {...line} />
    </Shape>
  );
}

// Мелкие точки и ромбы стоят в поле сбоку от содержимого (page-container: 1360px с отступами
// по 24px, текст начинается на 1312px от края), иначе ложатся на заголовки. Проценты, а не vw:
// ширина фонового слоя не включает полосу прокрутки. Где поле уже фигуры, её не показываем.
function Mark({
  shape,
  side,
  top,
  size,
  className,
}: {
  shape: 'dot' | 'diamond';
  side: 'left' | 'right';
  top: string;
  size: number;
  className: string;
}) {
  return (
    <Shape
      viewBox="0 0 10 10"
      className="hidden min-[1440px]:block"
      style={{ width: size, top, [side]: `calc((100% - 1312px) / 2 - ${size + 12}px)` }}
    >
      {shape === 'dot' ? (
        <circle cx="5" cy="5" r="5" className={className} />
      ) : (
        <rect
          x="1.5"
          y="1.5"
          width="7"
          height="7"
          rx="1"
          transform="rotate(45 5 5)"
          className={className}
        />
      )}
    </Shape>
  );
}

const CLOUD =
  'M8 72c0-12 14-19 30-16 4-20 26-30 44-20 10-22 46-28 62-6 14-12 40-8 44 12 18-2 36 10 38 26 6 1 8 4 4 4H8z';

// Облако белое с голубой тенью снизу: на светлом верху страницы одно белое не видно.
function Cloud({ style }: { style: CSSProperties }) {
  return (
    <Shape viewBox="0 0 240 80" style={style}>
      <path d={CLOUD} transform="translate(0 4)" className="fill-status-free/35" />
      <path d={CLOUD} className="fill-surface/90" />
    </Shape>
  );
}

function Circles() {
  return (
    <>
      <Shape
        viewBox="0 0 400 360"
        style={{ left: '-4vw', bottom: '-6vh', width: 'clamp(240px, 28vw, 440px)' }}
      >
        <ellipse cx="150" cy="330" rx="250" ry="210" fill="url(#bg-blob)" />
        <circle cx="40" cy="190" r="150" {...line} />
      </Shape>
      <Shape
        viewBox="0 0 400 300"
        style={{ right: '-3vw', top: '-4vh', width: 'clamp(220px, 26vw, 420px)' }}
      >
        <ellipse cx="240" cy="40" rx="230" ry="150" fill="url(#bg-blob)" />
        <circle cx="340" cy="130" r="120" {...line} />
      </Shape>
      <Shape
        viewBox="0 0 400 300"
        style={{ right: '-6vw', bottom: '-10vh', width: 'clamp(260px, 34vw, 560px)' }}
      >
        <ellipse cx="260" cy="260" rx="260" ry="200" fill="url(#bg-soft)" />
      </Shape>
      <Mark shape="dot" size={36} className="fill-accent/75" side="left" top="18vh" />
      <Mark shape="diamond" size={32} className="fill-accent/75" side="right" top="54vh" />
    </>
  );
}

function Hills() {
  return (
    <>
      <Cloud style={{ left: '3vw', top: '13vh', width: 'clamp(150px, 17vw, 260px)' }} />
      <Cloud style={{ right: '1vw', top: '5vh', width: 'clamp(170px, 22vw, 330px)' }} />
      <Cloud style={{ right: '7vw', top: '31vh', width: 'clamp(130px, 15vw, 230px)' }} />
      <Mark shape="dot" size={34} className="fill-accent/75" side="right" top="24vh" />
      <Ring style={{ right: '-7vw', top: '36vh', width: 'clamp(150px, 15vw, 240px)' }} />
      <Shape
        viewBox="0 0 1440 320"
        stretch
        style={{ left: 0, bottom: 0, width: '100%', height: 'clamp(140px, 30vh, 320px)' }}
      >
        <path d="M0 40c240-20 420 70 620 180 140 80 300 100 820 100H0z" fill="url(#bg-blob)" />
        <path d="M0 150c260-40 520 0 760 80 200 70 420-20 680-10v100H0z" fill="url(#bg-soft)" />
        <path
          d="M420 300c280-40 480-130 760-150 120-8 210 20 260 40v130H420z"
          fill="url(#bg-mint)"
        />
      </Shape>
    </>
  );
}

// Полосы-«таблетки» — это толстые линии с круглыми концами.
function Diagonals() {
  return (
    <>
      <Shape
        viewBox="0 0 400 500"
        style={{ left: '-3vw', top: '26vh', width: 'clamp(200px, 24vw, 380px)' }}
      >
        <line
          x1="-40"
          y1="420"
          x2="200"
          y2="180"
          strokeWidth="90"
          strokeLinecap="round"
          stroke="url(#bg-blob)"
        />
        <line
          x1="-40"
          y1="580"
          x2="70"
          y2="470"
          strokeWidth="80"
          strokeLinecap="round"
          stroke="url(#bg-soft)"
        />
        <line
          x1="140"
          y1="600"
          x2="320"
          y2="420"
          strokeWidth="60"
          strokeLinecap="round"
          stroke="url(#bg-soft)"
        />
        <circle cx="250" cy="300" r="22" className="fill-status-free/70" />
      </Shape>
      <Shape
        viewBox="0 0 400 400"
        style={{ right: '-2vw', top: '4vh', width: 'clamp(200px, 26vw, 400px)' }}
      >
        <line
          x1="-60"
          y1="520"
          x2="300"
          y2="160"
          strokeWidth="70"
          strokeLinecap="round"
          stroke="url(#bg-soft)"
        />
        <line
          x1="240"
          y1="230"
          x2="440"
          y2="30"
          strokeWidth="80"
          strokeLinecap="round"
          stroke="url(#bg-mint)"
        />
      </Shape>
      <Shape
        viewBox="0 0 600 400"
        style={{ left: '34vw', bottom: '-12vh', width: 'clamp(260px, 40vw, 640px)' }}
      >
        <line
          x1="40"
          y1="440"
          x2="420"
          y2="60"
          strokeWidth="90"
          strokeLinecap="round"
          stroke="url(#bg-soft)"
        />
      </Shape>
      <Mark shape="diamond" size={32} className="fill-accent/75" side="left" top="16vh" />
      <Ring style={{ right: '-3vw', bottom: '-9vh', width: 'clamp(150px, 13vw, 220px)' }} />
    </>
  );
}

function Lines() {
  return (
    <>
      <Shape
        viewBox="0 0 500 300"
        style={{ right: '-2vw', top: '-4vh', width: 'clamp(240px, 32vw, 500px)' }}
      >
        <ellipse cx="430" cy="30" rx="220" ry="140" fill="url(#bg-blob)" />
        <path d="M0 10c60 20 80 110 160 140s160 0 340-10" {...line} />
      </Shape>
      <Shape
        viewBox="0 0 400 260"
        style={{ left: '-3vw', bottom: '-4vh', width: 'clamp(220px, 28vw, 420px)' }}
      >
        <ellipse cx="140" cy="260" rx="260" ry="190" fill="url(#bg-blob)" />
      </Shape>
      {/* На телефоне кривая шла бы прямо через меню и заголовок. */}
      <Shape
        viewBox="0 0 400 700"
        className="max-sm:hidden"
        style={{ left: '-1vw', top: '14vh', width: 'clamp(180px, 24vw, 380px)' }}
      >
        <path d="M0 40c60 110 160 120 210 180 70 90 60 260 120 480" {...line} />
      </Shape>
      <Mark shape="dot" size={28} className="fill-accent/75" side="left" top="14vh" />
      <Mark shape="diamond" size={30} className="fill-status-free" side="right" top="48vh" />
      <Mark shape="dot" size={34} className="fill-status-success/70" side="right" top="80vh" />
    </>
  );
}
