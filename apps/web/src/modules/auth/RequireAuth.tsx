// Обёртка для страниц только для вошедших или только для некоторых ролей.
// Это удобство интерфейса; настоящая защита — requireRole на сервере.
//
//   { path: '/admin', element: <RequireAuth roles={['admin']}><AdminPage /></RequireAuth> }
import type { UserRole } from '@sport/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ButtonLink, Card } from '../../shared/ui';
import { useMe } from './api';

export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <p aria-busy="true">Загрузка…</p>;
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(me.data.role)) {
    return (
      <Card className="max-w-2xl">
        <h1 className="text-h2 mb-2">Нет доступа</h1>
        <p className="mb-4">Эта страница недоступна для вашего типа аккаунта.</p>
        <ButtonLink to="/" variant="secondary">
          На главную
        </ButtonLink>
      </Card>
    );
  }
  return children;
}
