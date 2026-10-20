// Покрытие площадки под видом спорта: шапка главной, карточки встречи, обложка профиля, 404.
// Покрытие подбирается по slug: стартовый каталог — явно, свой вид спорта — по теме названия
// (sportTheme), поэтому «Стритбол» получит паркет, а «Гребля» — бассейн без правок кода.
import { sportTheme, type SportTheme } from '@sport/shared/sportThemes';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import './surface.css';

export type SurfaceKind =
  'football' | 'court' | 'track' | 'pool' | 'chess' | 'table' | 'yoga' | 'custom' | 'corner';

const BY_SLUG: Record<string, SurfaceKind> = {
  футбол: 'football',
  баскетбол: 'court',
  волейбол: 'court',
  'настольный теннис': 'table',
  бег: 'track',
  велоспорт: 'track',
  'скандинавская ходьба': 'track',
  плавание: 'pool',
  шахматы: 'chess',
  йога: 'yoga',
};

const BY_THEME: Partial<Record<SportTheme, SurfaceKind>> = {
  pingPong: 'table',
  tennis: 'table',
  chess: 'chess',
  dice: 'chess',
  gamepad: 'chess',
  ball: 'football',
  rugby: 'football',
  baseball: 'football',
  run: 'track',
  walk: 'track',
  hike: 'track',
  bike: 'track',
  wave: 'pool',
  kayak: 'pool',
  sail: 'pool',
  fish: 'pool',
  yoga: 'yoga',
  stretch: 'yoga',
};

/** Игры с мячом на паркете, а не на газоне. */
const INDOOR_BALL = /баскет|стритбол|волейбол|гандбол|basket|volley|handball/;

export function surfaceFor(slug: string): SurfaceKind {
  const known = BY_SLUG[slug];
  if (known) return known;
  const theme = sportTheme(slug);
  if (theme === 'ball' && INDOOR_BALL.test(slug)) return 'court';
  return (theme && BY_THEME[theme]) || 'custom';
}

type Mark = { name: string; style?: CSSProperties; text?: string };

const LANES = [18, 36, 54, 72, 90];

/** Разметка каждого покрытия: где и как выглядит каждая линия — в surface.css. */
function marksOf(kind: SurfaceKind): Mark[] {
  switch (kind) {
    case 'football':
      return ['m-outer', 'm-half', 'm-circle', 'm-box-start', 'm-box-end'].map((name) => ({
        name,
      }));
    case 'corner':
      return [{ name: 'm-outer' }, { name: 'm-arc' }];
    case 'court':
      return ['m-outer', 'm-half', 'm-circle', 'm-arc-start', 'm-arc-end'].map((name) => ({
        name,
      }));
    case 'track':
      return LANES.flatMap((top, index) => [
        { name: 'm-lane', style: { top: `${top}%` } },
        { name: 'm-lane-no', style: { top: `${top - 15}%` }, text: String(index + 1) },
      ]);
    case 'pool':
      return [20, 40, 60, 80].map((top) => ({ name: 'm-rope', style: { top: `${top}%` } }));
    case 'table':
      return [{ name: 'm-outer' }, { name: 'm-mid' }, { name: 'm-net' }];
    case 'yoga':
      return [{ name: 'm-mat' }];
    case 'custom':
      return [
        { left: '10%', top: '20%' },
        { left: '32%', top: '72%' },
        { left: '66%', top: '24%' },
        { left: '88%', top: '68%' },
      ].map((style) => ({ name: 'm-cone', style }));
    case 'chess':
      return [];
  }
}

type Props = HTMLAttributes<HTMLDivElement> & { kind: SurfaceKind; children?: ReactNode };

export function SportSurface({ kind, className = '', children, ...props }: Props) {
  return (
    <div className={`sport-surface surface-${kind} ${className}`} {...props}>
      {marksOf(kind).map((mark, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`surface-mark ${mark.name}`}
          style={mark.style}
        >
          {mark.text}
        </span>
      ))}
      {children}
    </div>
  );
}

/** Табличка на покрытии: белая подложка с обводкой, чтобы текст читался на любой разметке. */
export function Plate({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-[12px] border-2 border-ink bg-surface px-2.5 shadow-sm box-decoration-clone ${className}`}
    >
      {children}
    </span>
  );
}
