// Блок аккаунта в шапке: «Войти» или имя, роль и «Выйти».
import { ROLE_LABELS } from '@sport/shared';
import { useNavigate } from 'react-router';
import { Avatar, Button, ButtonLink } from '../../shared/ui';
import { useLogout, useMe } from './api';

export function AccountMenu() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (me.isPending) return null;
  if (!me.data) {
    return (
      <ButtonLink to="/login" variant="secondary">
        Войти
      </ButtonLink>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar name={me.data.name} />
      <div className="leading-tight">
        <div className="font-semibold">{me.data.name}</div>
        <div className="text-sm text-ink-muted">{ROLE_LABELS[me.data.role]}</div>
      </div>
      <Button
        variant="secondary"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}
      >
        Выйти
      </Button>
    </div>
  );
}
