// Беговая дорожка под шапкой и над вкладками внизу экрана. Жёлтый участок дорожки стоит под
// открытым разделом меню и перебегает к пункту под курсором (макет «Шапка: беговая дорожка»,
// вариант А). Владелец: участник 3.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router';
import './RunningTrack.css';

// Участок шире пункта меню на столько с каждой стороны: слово не упирается в край.
const MARK_PAD = 10;

type Mark = { left: number; width: number; shown: boolean };

/** Дорожка под шапкой. navRef — меню шапки: участок встаёт под его открытый пункт. */
export function HeaderTrack({ navRef }: { navRef: RefObject<HTMLElement | null> }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const [mark, setMark] = useState<Mark | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    const strip = stripRef.current;
    if (!nav || !strip) return;
    let hovered: HTMLElement | null = null;

    const update = () => {
      const link = hovered ?? nav.querySelector<HTMLElement>('a[aria-current="page"]');
      // Меню спрятано (узкий экран) или открыта страница вне меню — участок гаснет на месте,
      // чтобы потом выбежать оттуда, а не из левого края.
      if (!link || !link.offsetParent) {
        setMark((prev) => (prev ? { ...prev, shown: false } : null));
        return;
      }
      const linkBox = link.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      setMark({
        left: linkBox.left - stripBox.left - MARK_PAD,
        width: linkBox.width + MARK_PAD * 2,
        shown: true,
      });
    };
    const enter = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link) return;
      hovered = link;
      update();
    };
    const leave = () => {
      hovered = null;
      update();
    };

    update();
    // Пункты меню появляются после загрузки аккаунта, ширина слов — после загрузки шрифта.
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    observer.observe(strip);
    void document.fonts.ready.then(update);
    nav.addEventListener('mouseover', enter);
    nav.addEventListener('focusin', enter);
    nav.addEventListener('mouseleave', leave);
    nav.addEventListener('focusout', leave);
    return () => {
      observer.disconnect();
      nav.removeEventListener('mouseover', enter);
      nav.removeEventListener('focusin', enter);
      nav.removeEventListener('mouseleave', leave);
      nav.removeEventListener('focusout', leave);
    };
  }, [navRef, pathname]);

  return (
    <div ref={stripRef} aria-hidden="true" className="running-track running-track--header">
      {mark && (
        <span
          className="running-track__mark"
          style={{ left: mark.left, width: mark.width, opacity: mark.shown ? 1 : 0 }}
        />
      )}
    </div>
  );
}

/** Дорожка над вкладками внизу экрана: участок над вкладкой index из count. */
export function TabTrack({ index, count }: { index: number; count: number }) {
  return (
    <div aria-hidden="true" className="running-track running-track--tabs">
      {index >= 0 && (
        <span
          className="running-track__mark"
          style={{ left: `${(index * 100) / count}%`, width: `${100 / count}%` }}
        />
      )}
    </div>
  );
}
