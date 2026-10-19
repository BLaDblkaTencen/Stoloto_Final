// Выпадающий список в стиле «Вместе»: раскрытый список системного <select> браузер рисует сам,
// и его не оформить. Здесь кнопка и список по шаблону WAI-ARIA «select-only combobox»:
// стрелки, Home/End, Enter и пробел, Esc, переход по первым буквам, экранный диктор слышит
// выбранный и активный пункт. Список открывается вверх, если внизу экрана не хватает места.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

export type ListboxOption = { value: string; label: string };

type Props = {
  id?: string;
  value: string;
  options: readonly ListboxOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Вид закрытого списка: рамка поля формы или текст без рамки (поиск на главной). */
  triggerClassName: string;
};

// Сколько места нужно под список; если внизу меньше, а вверху больше — открываем вверх.
const POPUP_SPACE = 320;
// Пауза между нажатиями, после которой набранные буквы начинают новый поиск.
const TYPEAHEAD_MS = 600;

export function Listbox({
  id,
  value,
  options,
  onChange,
  disabled = false,
  invalid = false,
  triggerClassName,
  ...aria
}: Props) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const listId = `${buttonId}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [upward, setUpward] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const current = options.find((option) => option.value === value);

  const openList = (activeIndex = selectedIndex) => {
    if (disabled || options.length === 0) return;
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setUpward(below < POPUP_SPACE && rect.top > below);
    }
    setActive(activeIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  };

  // Нажатие мимо списка закрывает его, ничего не меняя.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Активный пункт всегда виден, даже в длинном прокручиваемом списке.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const moveTo = (index: number) => {
      event.preventDefault();
      if (open) setActive(Math.min(last, Math.max(0, index)));
      else openList();
    };
    switch (event.key) {
      case 'ArrowDown':
        return moveTo(active + 1);
      case 'ArrowUp':
        return moveTo(active - 1);
      case 'Home':
        return open ? moveTo(0) : undefined;
      case 'End':
        return open ? moveTo(last) : undefined;
      case 'Enter':
      case ' ':
        event.preventDefault();
        return open ? choose(active) : openList();
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case 'Tab':
        setOpen(false);
        return;
    }
    // Первые буквы пункта: «з» — «Завтра», «бл» — «Ближайшие 7 дней».
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text =
        (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + event.key.toLowerCase();
      typed.current = { text, at: now };
      const index = options.findIndex((option) => option.label.toLowerCase().startsWith(text));
      if (index < 0) return;
      if (open) setActive(index);
      else openList(index);
    }
  };

  return (
    <div ref={root} className="relative min-w-0">
      <button
        type="button"
        id={buttonId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed ${triggerClassName}`}
        {...aria}
      >
        <span className={`min-w-0 truncate ${current?.value ? '' : 'text-ink-muted'}`}>
          {current?.label ?? ''}
        </span>
        <Icon
          name="chevronDown"
          size={18}
          strokeWidth={2.6}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={aria['aria-labelledby']}
          tabIndex={-1}
          // Фокус остаётся на кнопке: щелчок по пункту не уводит его со списка.
          onMouseDown={(event) => event.preventDefault()}
          className={[
            'absolute left-0 z-[1200] flex max-h-72 min-w-full flex-col gap-1 overflow-y-auto',
            'rounded-[18px] border-2 border-ink bg-surface p-1.5 text-base text-ink shadow-md',
            upward ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={[
                  'flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md px-3.5 font-semibold whitespace-nowrap',
                  selected ? 'bg-accent' : index === active ? 'bg-surface-muted' : '',
                  index === active ? 'shadow-[inset_0_0_0_2px_var(--color-ink)]' : '',
                ].join(' ')}
              >
                <span>{option.label}</span>
                {selected && <Icon name="check" size={18} strokeWidth={2.8} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
