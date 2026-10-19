// Регистрация: имя, email, пароль и тип аккаунта. Администратора здесь создать нельзя.
import { zodFieldErrors } from '@sport/shared';
import { registerBody, type RegisterBody } from '@sport/shared/schemas/auth';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api/client';
import { Alert, Button, Card, RadioCards, TextField } from '../../shared/ui';
import { safeNext, useMe, useRegister } from './api';

const ACCOUNT_TYPES: { value: RegisterBody['role']; title: string; text: string }[] = [
  { value: 'user', title: 'Я участник', text: 'Ищу компанию для спорта и создаю свои встречи' },
  {
    value: 'organization',
    title: 'Я представляю организацию',
    text: 'Клуб, кружок, федерация. После регистрации подам заявку на допуск',
  },
];

export function RegisterPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const me = useMe();
  const register = useRegister();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [fields, setFields] = useState<Record<string, string>>({});

  if (me.data) return <Navigate to={next} replace />;

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = registerBody.safeParse(form);
    if (!parsed.success) return setFields(zodFieldErrors(parsed.error));
    setFields({});
    register.mutate(parsed.data, {
      onSuccess: () => navigate(next, { replace: true }),
      onError: (error) => {
        if (error instanceof ApiError) setFields(error.fields);
      },
    });
  };

  const requestError =
    register.error instanceof ApiError
      ? register.error.message
      : register.error
        ? 'Не удалось зарегистрироваться'
        : null;

  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-h2 mb-6">Регистрация</h1>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {requestError && <Alert>{requestError}</Alert>}

        <RadioCards
          legend="Тип аккаунта"
          options={ACCOUNT_TYPES}
          value={form.role as RegisterBody['role'] | ''}
          onChange={set('role')}
          error={fields.role}
        />

        <TextField
          label="Имя"
          autoComplete="name"
          hint={form.role === 'organization' ? 'Ваше имя как представителя организации' : undefined}
          value={form.name}
          onChange={(e) => set('name')(e.target.value)}
          error={fields.name}
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          error={fields.email}
        />
        <TextField
          label="Пароль"
          type="password"
          autoComplete="new-password"
          hint="Не короче 8 символов"
          value={form.password}
          onChange={(e) => set('password')(e.target.value)}
          error={fields.password}
        />
        <Button type="submit" size="lg" loading={register.isPending}>
          {register.isPending ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </Button>
      </form>
      <p className="mt-6">
        Уже есть аккаунт?{' '}
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold">
          Войти
        </Link>
      </p>
    </Card>
  );
}
