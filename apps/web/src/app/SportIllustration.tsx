// Спортсмен над подвалом: иллюстрация в конце страницы справа, у каждого раздела своя.
// Стоит там, где обычно пусто (последняя карточка короче ряда, правая колонка кончается раньше),
// и прокручивается вместе со страницей. Пастельная подложка картинки растворяется к краям
// (маска) и «умножается» на голубой фон, поэтому квадрата не видно — остаётся спортсмен.
// Картинки — центральный рисунок из sports_fhd_6_images (по бокам там дорисованные полосы со швами).
import { useLocation } from 'react-router';
import basketball from './backgrounds/basketball.webp';
import bike from './backgrounds/bike.webp';
import run from './backgrounds/run.webp';
import ski from './backgrounds/ski.webp';
import swim from './backgrounds/swim.webp';
import tennis from './backgrounds/tennis.webp';

/** Картинка раздела; null — не показываем: на главной всю ширину занимает площадка вида спорта. */
function illustrationFor(pathname: string): string | null {
  if (pathname === '/') return null;
  if (pathname === '/events/new' || pathname.endsWith('/edit') || pathname.startsWith('/map')) {
    return bike;
  }
  if (pathname.startsWith('/events/') || pathname.startsWith('/organizations')) return basketball;
  if (pathname.startsWith('/me/events') || pathname === '/org' || pathname.startsWith('/org/')) {
    return tennis;
  }
  if (pathname.startsWith('/users') || pathname.startsWith('/me/profile')) return swim;
  if (pathname.startsWith('/admin')) return swim;
  if (pathname === '/login' || pathname === '/register') return ski;
  return run;
}

/** Внутри main (relative): у правого края колонки содержимого, над подвалом. */
export function SportIllustration() {
  const { pathname } = useLocation();
  const src = illustrationFor(pathname);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      // На телефоне содержимое во всю ширину и спортсмен целиком за карточками — не показываем.
      className="pointer-events-none absolute bottom-0 -z-10 w-[clamp(190px,27vw,400px)] mix-blend-multiply max-sm:hidden"
      style={{
        maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)',
        // На широком экране — в свободное поле справа от колонки (1360px), но не за край окна,
        // иначе появилась бы горизонтальная прокрутка.
        right: 'min(0px, calc((1360px - 100vw) / 2 + 24px))',
      }}
    />
  );
}
