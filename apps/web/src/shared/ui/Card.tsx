// Карточка с обводкой и жёсткой тенью — основной контейнер блоков на странице.
// Цвет фона задаётся tone, а не классом: два класса фона спорили бы между собой.
import type { HTMLAttributes } from 'react';

const TONES = {
  surface: 'bg-surface',
  accent: 'bg-accent',
  request: 'bg-status-request',
  free: 'bg-status-free',
  success: 'bg-status-success',
} as const;

type Props = HTMLAttributes<HTMLElement> & { tone?: keyof typeof TONES };

export function Card({ tone = 'surface', className = '', ...props }: Props) {
  return (
    <section
      className={`rounded-lg border-2 border-ink p-6 shadow-md ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}
