// Подвал всех страниц: логотип, ссылки для участников и для клубов, строка о прототипе.
// Владелец: участник 3. Макет — вариант 1 «Жёлтая линия сверху и три колонки».
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMe } from '../modules/auth/api';
import { Logo } from './Logo';

// После регистрации организация попадает в кабинет: там она заполняет профиль и подаёт заявку.
const REGISTER_ORGANIZATION = `/register?role=organization&next=${encodeURIComponent('/org')}`;

export function Footer() {
  const me = useMe();
  const role = me.data?.role;
  const guest = !me.isPending && !me.data;

  return (
    <footer className="border-t-8 border-accent bg-surface">
      <div className="page-container flex flex-col gap-7 pt-9 pb-7">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-16">
          <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
            <Logo />
            <p className="max-w-[360px] text-ink-muted">
              Больше, чем спорт — это люди. Встречи рядом с вами в Красноярске.
            </p>
          </div>

          <FooterNav title="Участникам">
            <FooterLink to="/">Встречи</FooterLink>
            <FooterLink to="/map">Карта и площадки</FooterLink>
            {/* Как в шапке: администратор встречи не создаёт. */}
            {!me.isPending && role !== 'admin' && (
              <FooterLink to="/events/new">Создать встречу</FooterLink>
            )}
          </FooterNav>

          {/* Каталог — для всех; вторая ссылка зависит от роли: /org пускает только организацию,
              гостю нужна регистрация, участнику организацию заводить отдельным аккаунтом. */}
          <FooterNav title="Клубам и сообществам">
            <FooterLink to="/organizations">Организации</FooterLink>
            {guest && (
              <>
                <FooterLink to={REGISTER_ORGANIZATION}>Зарегистрировать организацию</FooterLink>
                <p className="text-sm text-ink-muted">
                  Страница клуба появится после проверки администратором
                </p>
              </>
            )}
            {role === 'organization' && <FooterLink to="/org">Кабинет организации</FooterLink>}
            {role === 'admin' && (
              <FooterLink to="/admin/organizations">Заявки организаций</FooterLink>
            )}
          </FooterNav>
        </div>

        <p className="border-t-2 border-dashed border-line-soft pt-4 text-sm text-ink-muted">
          © 2026 · прототип для финала ЧР по продуктовому программированию, кейс Столото
        </p>
      </div>
    </footer>
  );
}

function FooterNav({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex min-w-0 flex-col gap-1 md:gap-2.5">
      <h2 className="font-sans text-base font-semibold">{title}</h2>
      {children}
    </nav>
  );
}

/** На телефоне ссылка не ниже 44px: по ней удобно попасть пальцем. */
function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-11 items-center md:min-h-0">
      {children}
    </Link>
  );
}
