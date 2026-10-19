// Аватар с инициалами вместо фото: «Иван Петров» → «ИП», «Клуб «Е2–Е4»» → «КЕ».
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
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-status-free font-display text-sm font-bold"
    >
      {initials(name)}
    </span>
  );
}
