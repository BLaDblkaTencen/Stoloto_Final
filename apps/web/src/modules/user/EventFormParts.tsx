// Части формы встречи, где почти не нужно печатать: плитки видов спорта, кнопки дня и времени,
// карточки режима записи, счётчик мест. Значения те же, что у обычных полей формы (строки
// «2026-10-24», «08:00», «12»), поэтому проверка и отправка в EventFormPage не меняются.
import { EVENT_LIMITS } from '@sport/shared/schemas/events';
import type { JoinMode } from '@sport/shared';
import type { Sport } from '@sport/shared/schemas/sports';
import { useState, type ReactNode } from 'react';
import { Chip, FieldError, Icon, sportColor, sportIcon, TextField } from '../../shared/ui';
import { formatDayLabel, isoDay } from './format';

/** Группа выбора с подписью; ошибка — под ней, как у обычного поля. */
function Group({
  legend,
  hint,
  error,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 font-semibold">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-ink-muted">{hint}</p>}
      {children}
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}

const tileClass = (on: boolean) =>
  [
    'flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-ink p-2',
    'text-center text-sm leading-tight font-semibold hyphens-auto [overflow-wrap:break-word] transition-[translate,rotate,box-shadow] duration-100',
    on
      ? '-translate-x-0.5 -translate-y-0.5 shadow-md'
      : 'bg-surface hover:-translate-y-0.5 hover:shadow-sm',
  ].join(' ');

/** Вид спорта плитками в его цвете; «Своё» — вписать новый вид. */
export function SportTiles({
  sports,
  value,
  customValue,
  onChange,
  error,
}: {
  sports: Sport[];
  value: string;
  /** Значение плитки «Своё». */
  customValue: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const custom = value === customValue;
  return (
    <Group legend="Вид спорта" error={error}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))]">
        {sports.map((sport, index) => {
          const on = sport.id === value;
          return (
            <button
              key={sport.id}
              type="button"
              aria-pressed={on}
              // Фокус после неудачной отправки попадает на первую плитку группы с ошибкой.
              aria-invalid={error && index === 0 ? true : undefined}
              onClick={() => onChange(sport.id)}
              className={tileClass(on)}
              style={{
                background: on ? sportColor(sport.slug) : undefined,
                rotate: on ? '-1.5deg' : undefined,
              }}
            >
              <Icon name={sportIcon(sport.slug)} size={30} strokeWidth={1.7} />
              {sport.name}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => onChange(customValue)}
          className={`${tileClass(custom)} border-dashed`}
          style={{ background: custom ? 'var(--color-accent)' : undefined }}
        >
          <Icon name="plus" size={30} strokeWidth={1.7} />
          Своё
        </button>
      </div>
    </Group>
  );
}

/** Сегодня, завтра и ближайшие выходные — одной кнопкой; остальное — «Другой день». */
function quickDays() {
  const days = [
    { day: isoDay(0), label: 'Сегодня' },
    { day: isoDay(1), label: 'Завтра' },
  ];
  for (let n = 2; n <= 7; n++) {
    const day = isoDay(n);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 6 || weekday === 0) days.push({ day, label: formatDayLabel(day) });
  }
  return days;
}

export function DayPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (day: string) => void;
  error?: string;
}) {
  const quick = quickDays();
  const [other, setOther] = useState(() => value !== '' && !quick.some((q) => q.day === value));
  return (
    <Group legend="День" error={other ? undefined : error}>
      <div className="flex flex-wrap gap-2.5">
        {quick.map((q, index) => (
          <Chip
            key={q.day}
            index={index}
            pressed={!other && value === q.day}
            aria-invalid={error && index === 0 ? true : undefined}
            onClick={() => {
              setOther(false);
              onChange(q.day);
            }}
          >
            {q.label}
          </Chip>
        ))}
        <Chip index={quick.length} icon="calendar" pressed={other} onClick={() => setOther(true)}>
          Другой день
        </Chip>
      </div>
      {other && (
        <TextField
          label="Дата"
          type="date"
          min={isoDay(0)}
          className="max-w-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error}
        />
      )}
    </Group>
  );
}

const TIMES = ['07:00', '08:00', '10:00', '12:00', '18:00', '19:00', '20:00'];

export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const [other, setOther] = useState(() => value !== '' && !TIMES.includes(value));
  return (
    <Group legend="Начало">
      <div className="flex flex-wrap gap-2.5">
        {TIMES.map((time, index) => (
          <Chip
            key={time}
            index={index + 2}
            pressed={!other && value === time}
            onClick={() => {
              setOther(false);
              onChange(time);
            }}
          >
            {time}
          </Chip>
        ))}
        <Chip index={1} icon="clock" pressed={other} onClick={() => setOther(true)}>
          Другое время
        </Chip>
      </div>
      {other && (
        <TextField
          label="Время начала"
          type="time"
          className="max-w-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Group>
  );
}

const MODES: { value: JoinMode; icon: 'door' | 'lock'; title: string; text: string }[] = [
  {
    value: 'free',
    icon: 'door',
    title: 'Свободно',
    text: 'Нажал «Записаться» — и сразу в списке участников',
  },
  {
    value: 'request',
    icon: 'lock',
    title: 'По заявке',
    text: 'Человек пишет заявку, вы решаете, кого принять',
  },
];

/** Режим записи двумя большими карточками в цвете бейджа режима. */
export function JoinModeCards({
  value,
  onChange,
  error,
}: {
  value: JoinMode | '';
  onChange: (mode: JoinMode) => void;
  error?: string;
}) {
  return (
    <Group legend="Режим записи" error={error}>
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((mode, index) => {
          const on = value === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              aria-pressed={on}
              aria-invalid={error && index === 0 ? true : undefined}
              onClick={() => onChange(mode.value)}
              className={[
                'flex items-start gap-3 rounded-[20px] border-2 border-ink p-4 text-left',
                'transition-[translate,box-shadow] duration-100',
                on
                  ? '-translate-x-0.5 -translate-y-0.5 shadow-md'
                  : 'bg-surface hover:-translate-y-0.5 hover:shadow-sm',
              ].join(' ')}
              style={{ background: on ? `var(--status-${mode.value})` : undefined }}
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-surface">
                <Icon name={mode.icon} size={26} />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-semibold">{mode.title}</span>
                <span className="text-sm text-ink-muted">{mode.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Group>
  );
}

/** Число мест кнопками «−» и «+» или «Без ограничения». Пустая строка — без ограничения. */
export function SeatsField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { min, max } = EVENT_LIMITS.capacity;
  const n = value.trim() === '' ? null : Number(value);
  const step = (delta: number) => {
    const base = n === null || Number.isNaN(n) ? 10 : n + delta;
    onChange(String(Math.min(max, Math.max(min, base))));
  };
  const stepClass =
    'inline-flex min-h-12 min-w-12 items-center justify-center text-2xl font-bold hover:bg-surface-muted disabled:opacity-40';
  return (
    <Group legend="Сколько мест" error={error}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-md border-2 border-ink bg-surface shadow-sm">
          <button
            type="button"
            aria-label="Меньше мест"
            className={stepClass}
            disabled={n !== null && n <= min}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            aria-label="Число мест"
            aria-invalid={error ? true : undefined}
            inputMode="numeric"
            placeholder="—"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
            className="w-20 border-x-2 border-ink text-center font-display text-[22px] font-bold outline-none focus-visible:bg-accent"
          />
          <button
            type="button"
            aria-label="Больше мест"
            className={stepClass}
            disabled={n !== null && n >= max}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>
        <Chip pressed={value.trim() === ''} index={2} onClick={() => onChange('')}>
          Без ограничения
        </Chip>
      </div>
    </Group>
  );
}
