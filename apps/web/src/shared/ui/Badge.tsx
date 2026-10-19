// Бейджи состояний: пастельный фон, обводка, иконка и подпись. Состояние никогда не передаётся
// одним цветом. Подписи и цвета — из docs/DATA_MODEL.md и docs/design/README.md.
import {
  EVENT_STATUS_LABELS,
  JOIN_MODE_LABELS,
  ORG_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  type EventStatus,
  type JoinMode,
  type OrgStatus,
  type RegistrationStatus,
} from '@sport/shared';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'free' | 'request' | 'plain';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  neutral: 'bg-status-neutral',
  free: 'bg-status-free',
  request: 'bg-status-request',
  plain: 'bg-surface',
};

const TONE_ICON: Record<Exclude<Tone, 'plain'>, IconName> = {
  success: 'check',
  warning: 'clock',
  danger: 'cross',
  neutral: 'eyeOff',
  free: 'door',
  request: 'lock',
};

export function Badge({
  tone = 'plain',
  icon,
  children,
}: {
  tone?: Tone;
  /** По умолчанию иконка тона; null — без иконки (только для нейтральных подписей). */
  icon?: IconName | null;
  children: ReactNode;
}) {
  const iconName = icon === undefined && tone !== 'plain' ? TONE_ICON[tone] : icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-semibold ${TONE_CLASS[tone]}`}
    >
      {iconName && <Icon name={iconName} size={16} strokeWidth={2.6} />}
      {children}
    </span>
  );
}

const REGISTRATION_TONE: Record<RegistrationStatus, Tone> = {
  confirmed: 'success',
  pending: 'warning',
  rejected: 'danger',
  cancelled: 'neutral',
};
const ORG_TONE: Record<OrgStatus, Tone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};
const EVENT_TONE: Record<EventStatus, Tone> = {
  published: 'success',
  unpublished: 'neutral',
  deleted: 'danger',
};

type StatusProps =
  | { kind: 'registration'; status: RegistrationStatus }
  | { kind: 'organization'; status: OrgStatus }
  | { kind: 'event'; status: EventStatus };

/** Статус записи, заявки организации или мероприятия: <StatusBadge kind="registration" status="pending" />. */
export function StatusBadge(props: StatusProps) {
  switch (props.kind) {
    case 'registration':
      return (
        <Badge tone={REGISTRATION_TONE[props.status]}>
          {REGISTRATION_STATUS_LABELS[props.status]}
        </Badge>
      );
    case 'organization':
      return <Badge tone={ORG_TONE[props.status]}>{ORG_STATUS_LABELS[props.status]}</Badge>;
    case 'event':
      return <Badge tone={EVENT_TONE[props.status]}>{EVENT_STATUS_LABELS[props.status]}</Badge>;
  }
}

/** Режим записи: «Свободная запись» с дверью или «По заявке» с замком. */
export function JoinModeBadge({ mode }: { mode: JoinMode }) {
  return <Badge tone={mode}>{JOIN_MODE_LABELS[mode]}</Badge>;
}
