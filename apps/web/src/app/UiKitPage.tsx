// Витрина shared/ui: все компоненты и их состояния на одной странице. Только в режиме разработки
// (pnpm dev → /ui), в сборку для экспертов не попадает. Владелец: участник 3.
import { useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  JoinModeBadge,
  Modal,
  RadioCards,
  SelectField,
  SkeletonList,
  SportChip,
  StatusBadge,
  TextareaField,
  TextField,
} from '../shared/ui';

const SPORTS = [
  'Футбол',
  'Бег',
  'Шахматы',
  'Йога',
  'Зарядка во дворе',
  'Плавание',
  'Велоспорт',
  'Скандинавская ходьба',
].map((name) => ({ name, slug: name.toLowerCase().replaceAll('ё', 'е') }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h3">{title}</h2>
      {children}
    </section>
  );
}

export function UiKitPage() {
  const [selected, setSelected] = useState(['футбол']);
  const [mode, setMode] = useState<'free' | 'request' | ''>('');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-h2">Компоненты shared/ui</h1>

      <Section title="Кнопки">
        <div className="flex flex-wrap gap-3">
          <Button>Записаться</Button>
          <Button variant="dark">Подать заявку</Button>
          <Button variant="secondary">Подробнее</Button>
          <Button variant="danger">Снять с публикации</Button>
          <Button loading>Отправляем…</Button>
          <Button size="lg">Найти</Button>
          <ButtonLink to="/ui" variant="secondary">
            Ссылка-кнопка
          </ButtonLink>
        </div>
      </Section>

      <Section title="Бейджи статусов">
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="registration" status="confirmed" />
          <StatusBadge kind="registration" status="pending" />
          <StatusBadge kind="registration" status="rejected" />
          <StatusBadge kind="registration" status="cancelled" />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="organization" status="approved" />
          <StatusBadge kind="organization" status="pending" />
          <StatusBadge kind="organization" status="rejected" />
          <StatusBadge kind="event" status="published" />
          <StatusBadge kind="event" status="unpublished" />
          <StatusBadge kind="event" status="deleted" />
        </div>
        <div className="flex flex-wrap gap-2">
          <JoinModeBadge mode="free" />
          <JoinModeBadge mode="request" />
          <Badge icon="people">8 из 16</Badge>
          <Badge icon={null}>Для новичков</Badge>
        </div>
      </Section>

      <Section title="Чипы видов спорта">
        <div role="group" aria-label="Вид спорта" className="flex flex-wrap gap-3">
          {SPORTS.map((sport, index) => (
            <SportChip
              key={sport.slug}
              sport={sport}
              index={index}
              pressed={selected.includes(sport.slug)}
              onClick={() =>
                setSelected((current) =>
                  current.includes(sport.slug)
                    ? current.filter((slug) => slug !== sport.slug)
                    : [...current, sport.slug],
                )
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Поля формы">
        <Card className="grid max-w-3xl gap-5 md:grid-cols-2">
          <TextField label="Название" placeholder="Дворовый футбол 5×5" />
          <TextField label="С ошибкой" defaultValue="аб" error="Не короче 3 символов" />
          <SelectField
            label="Вид спорта"
            placeholder="Выберите вид спорта"
            options={SPORTS.map((s) => ({ value: s.slug, label: s.name }))}
          />
          <TextField label="Недоступно" disabled defaultValue="Только для чтения" />
          <TextareaField
            label="Условия участия"
            hint="Что взять с собой, какой уровень подготовки нужен"
            className="md:col-span-2"
          />
          <div className="md:col-span-2">
            <RadioCards
              legend="Режим записи"
              inline
              value={mode}
              onChange={setMode}
              error={mode ? undefined : 'Выберите режим записи'}
              options={[
                { value: 'free', title: 'Свободная запись', text: 'Человек сразу в составе' },
                { value: 'request', title: 'По заявке', text: 'Вы решаете, кого принять' },
              ]}
            />
          </div>
        </Card>
      </Section>

      <Section title="Сообщения и окно">
        <div className="flex max-w-2xl flex-col gap-3">
          <Alert>Неверный email или пароль</Alert>
          <Alert tone="warning">
            Организация ещё на рассмотрении: публиковать события пока нельзя
          </Alert>
          <Alert tone="success">Заявка отправлена</Alert>
        </div>
        <div>
          <Button variant="danger" onClick={() => setModalOpen(true)}>
            Открыть окно
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Снять мероприятие с публикации"
          actions={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button variant="danger" onClick={() => setModalOpen(false)}>
                Снять
              </Button>
            </>
          }
        >
          <TextareaField label="Причина" hint="Её увидят организатор и записавшиеся" />
        </Modal>
      </Section>

      <Section title="Состояния">
        <div className="grid gap-6 lg:grid-cols-3">
          <EmptyState
            title="Пока нет событий"
            text="Попробуйте другой вид спорта или создайте встречу сами"
            action={<Button>Создать встречу</Button>}
          />
          <ErrorState error={new Error()} onRetry={() => undefined} />
          <SkeletonList count={2} />
        </div>
      </Section>

      <Section title="Карточки и аватары">
        <div className="flex flex-wrap gap-4">
          <Card>Обычная</Card>
          <Card tone="request">Сиреневая</Card>
          <Card tone="accent">Жёлтая</Card>
          <div className="flex items-center gap-3">
            <Avatar name="Иван Петров" />
            <Avatar name="клуб «Е2–Е4»" />
            <Avatar name="Анна" size={56} />
          </div>
        </div>
      </Section>
    </div>
  );
}
