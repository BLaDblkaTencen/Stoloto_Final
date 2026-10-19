// Вход: email и пароль либо демо-аккаунт одной кнопкой.
import { DEMO_ACCOUNTS, DEMO_PASSWORD, zodFieldErrors } from '@sport/shared';
import { loginBody } from '@sport/shared/schemas/auth';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import { Alert, Button, Card, TextField } from '../../shared/ui';
import { safeNext, useLogin, useMe } from './api';

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const me = useMe();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  if (me.data) return <Navigate to={next} replace />;

  const signIn = (body: { email: string; password: string }) =>
    login.mutate(body, { onSuccess: () => navigate(next, { replace: true }) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginBody.safeParse({ email, password });
    setFields(parsed.success ? {} : zodFieldErrors(parsed.error));
    if (parsed.success) signIn(parsed.data);
  };

  const requestError =
    login.error instanceof ApiError ? login.error.message : login.error ? 'Не удалось войти' : null;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_minmax(0,22rem)]">
      <Card>
        <h1 className="text-h2 mb-6">Вход</h1>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {requestError && <Alert>{requestError}</Alert>}
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
          />
          <TextField
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fields.password}
          />
          <Button type="submit" size="lg" loading={login.isPending}>
            {login.isPending ? 'Входим…' : 'Войти'}
          </Button>
        </form>
        <p className="mt-6">
          Нет аккаунта?{' '}
          <Link to={`/register?next=${encodeURIComponent(next)}`} className="font-semibold">
            Зарегистрироваться
          </Link>
        </p>
      </Card>

      <Card tone="request">
        <h2 className="text-h3 mb-2">Демо-аккаунты</h2>
        <p className="mb-4">Для проверки: вход в один клик, без пароля.</p>
        <div className="flex flex-col gap-3">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              variant="secondary"
              size="lg"
              className="py-2"
              disabled={login.isPending}
              onClick={() => signIn({ email: account.email, password: DEMO_PASSWORD })}
            >
              <span className="flex w-full flex-col items-start text-left">
                <span>Войти как {account.label.toLowerCase()}</span>
                <span className="text-sm font-normal text-ink-muted">{account.email}</span>
              </span>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
