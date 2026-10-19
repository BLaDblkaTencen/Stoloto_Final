// Аватар с инициалами вместо фото: «Иван Петров» → «ИП», «Клуб «Е2–Е4»» → «КЕ».
// Цвет — из палитры видов спорта по имени: у каждого человека свой и всегда один и тот же.
import { sportColor } from './sport';

export function initials(name: string) {
  // Первая буква или цифра каждого слова: кавычки, тире и скобки пропускаем.
  const letters = name
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter(Boolean)
    .slice(0, 2)
    .map((letter) => letter!.toUpperCase());
  return letters.join('') || '?';
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: sportColor(name.trim().toLowerCase()),
        // Инициалы растут вместе с аватаром, но не мельче 16px (DESIGN_BRIEF).
        fontSize: Math.max(16, Math.round(size * 0.36)),
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display leading-none font-bold shadow-sm"
    >
      {initials(name)}
    </span>
  );
}
