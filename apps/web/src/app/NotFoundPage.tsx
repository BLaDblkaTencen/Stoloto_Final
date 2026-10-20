// Страница 404: «Мяч ушёл в аут» на углу поля (атрибут страниц варианта Б2).
import { ButtonLink, Icon } from '../shared/ui';
import { Plate, SportSurface } from '../modules/user/surface/SportSurface';

export function NotFoundPage() {
  return (
    <SportSurface
      kind="corner"
      className="flex max-w-2xl flex-col items-start gap-4 rounded-lg border-2 border-ink p-8 pb-28 shadow-md"
    >
      <h1 className="text-h2 leading-[1.35]">
        <Plate>Мяч ушёл в аут</Plate>
      </h1>
      <p className="max-w-md rounded-md border-2 border-ink bg-surface p-3">
        Такой страницы нет: ссылка устарела или в адресе опечатка.
      </p>
      <ButtonLink to="/">Вернуться к встречам</ButtonLink>
      <span
        aria-hidden="true"
        className="absolute right-8 bottom-6 inline-flex size-16 rotate-12 items-center justify-center rounded-full border-2 border-ink bg-surface shadow-md"
      >
        <Icon name="ball" size={38} strokeWidth={1.8} />
      </span>
    </SportSurface>
  );
}
