// Демо-данные: вымышленные люди, организации, площадки и события в Красноярске. Владелец: участник 3.
// Подобраны так, чтобы эксперт прошёл шесть сценариев ТЗ демо-аккаунтами, ничего не создавая руками:
// какие записи для каких сценариев — в docs/DEMO_DATA.md. Ссылки между записями — по ключам.
// Площадки и подходящие им виды спорта — из таблицы участника 2 (docs/DEMO_VENUES.md).
import {
  DEMO_ACCOUNTS,
  type EventLevel,
  type JoinMode,
  type UserRole,
  type VenueType,
} from '@sport/shared';
import type { ReviewTag } from '@sport/shared/schemas/reviews';

const demo = (email: string) => {
  const account = DEMO_ACCOUNTS.find((a) => a.email === email);
  if (!account) throw new Error(`Нет демо-аккаунта ${email}`);
  return { role: account.role, name: account.name, email: account.email };
};

export type UserKey =
  'user1' | 'user2' | 'user3' | 'orgApproved' | 'orgPending' | 'orgRejected' | 'admin';

export const USERS: Record<
  UserKey,
  { role: UserRole; name: string; email: string; about?: string }
> = {
  user1: { ...demo('user1@demo.local'), about: 'Бегаю по утрам, хочу найти компанию для футбола' },
  user2: {
    role: 'user',
    name: 'Мария Соколова',
    email: 'user2@demo.local',
    about: 'Йога и плавание',
  },
  user3: {
    role: 'user',
    name: 'Алексей Смирнов',
    email: 'user3@demo.local',
    about: 'Настольный теннис, баскетбол',
  },
  orgApproved: demo('org.approved@demo.local'),
  orgPending: { role: 'organization', name: 'Дмитрий Козлов', email: 'org.pending@demo.local' },
  orgRejected: { role: 'organization', name: 'Ольга Новикова', email: 'org.rejected@demo.local' },
  admin: demo('admin@demo.local'),
};

/** Стартовый каталог (DATA_MODEL.md) и подходящие типы площадок (DEMO_VENUES.md). */
export const SPORTS: { name: string; venueTypes: VenueType[] }[] = [
  { name: 'Футбол', venueTypes: ['field', 'hall'] },
  { name: 'Баскетбол', venueTypes: ['hall', 'yard'] },
  { name: 'Волейбол', venueTypes: ['hall', 'field'] },
  { name: 'Бег', venueTypes: ['park'] },
  { name: 'Шахматы', venueTypes: ['cafe', 'club'] },
  { name: 'Йога', venueTypes: ['hall', 'park'] },
  { name: 'Зарядка во дворе', venueTypes: ['yard', 'park'] },
  { name: 'Настольный теннис', venueTypes: ['club', 'hall'] },
  { name: 'Плавание', venueTypes: ['pool'] },
  { name: 'Велоспорт', venueTypes: ['park'] },
];

/** Вид спорта, который «добавил пользователь»: показывает, что каталог расширяется без кода. */
export const CUSTOM_SPORT = { name: 'Скандинавская ходьба', createdBy: 'user3' as UserKey };

type Venue = {
  key: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  workingHours?: string;
  contactName?: string;
  contactPhone?: string;
  contactNote?: string;
};

// Всё вымышленное, телефоны вида +7 900 000-01-NN не существуют. Реальные только два парка, без контактов.
export const VENUES: Venue[] = [
  {
    key: 'hodKonem',
    name: 'Кафе «Ход конём»',
    type: 'cafe',
    address: 'пр. Мира, 12',
    lat: 56.0102,
    lng: 92.8512,
    workingHours: 'ежедневно 10:00–22:00',
    contactName: 'Ирина Соколова, администратор',
    contactPhone: '+7 900 000-01-01',
    contactNote: 'Звоните ежедневно с 10 до 20, столы на вечер бронируем за день',
  },
  {
    key: 'belayaLadya',
    name: 'Кафе «Белая ладья»',
    type: 'cafe',
    address: 'ул. Ленина, 98',
    lat: 56.0148,
    lng: 92.8601,
    workingHours: '09:00–23:00',
    contactName: 'Павел Громов, управляющий',
    contactPhone: '+7 900 000-01-02',
    contactNote: 'Большой зал, можно сдвинуть столы, предупредите за 3 дня',
  },
  {
    key: 'endshpil',
    name: 'Шахматный клуб «Эндшпиль»',
    type: 'club',
    address: 'ул. Карла Маркса, 45',
    lat: 56.0063,
    lng: 92.845,
    workingHours: 'вт–вс 12:00–21:00',
    contactName: 'Марина Белова, администратор клуба',
    contactPhone: '+7 900 000-01-03',
    contactNote: 'Есть доски и часы, нужна запись заранее',
  },
  {
    key: 'gambit',
    name: 'Кафе-клуб настольных игр «Гамбит»',
    type: 'cafe',
    address: 'ул. Перенсона, 7',
    lat: 56.0185,
    lng: 92.842,
    workingHours: '11:00–24:00',
    contactName: 'Олег Фомин, администратор',
    contactPhone: '+7 900 000-01-04',
    contactNote: 'Тихий зал, можно приходить компанией до 12 человек',
  },
  {
    key: 'severnoe',
    name: 'Поле «Северное»',
    type: 'field',
    address: 'ул. Взлётная, 20',
    lat: 56.029,
    lng: 92.842,
    workingHours: 'ежедневно 08:00–22:00',
    contactName: 'Андрей Крылов, смотритель',
    contactPhone: '+7 900 000-01-05',
    contactNote: 'Искусственное покрытие, ворота и разметка есть, мячи берите свои',
  },
  {
    key: 'legendy',
    name: 'Поле «Дворовые легенды»',
    type: 'field',
    address: 'ул. Академика Павлова, 3',
    lat: 56.0035,
    lng: 92.833,
    workingHours: '08:00–21:00',
    contactName: 'Сергей Левин, организатор площадки',
    contactPhone: '+7 900 000-01-06',
    contactNote: 'Бесплатно по выходным утром, вечером по записи',
  },
  {
    key: 'dinamika',
    name: 'Спортзал «Динамика»',
    type: 'hall',
    address: 'ул. Весны, 15',
    lat: 56.012,
    lng: 92.8575,
    workingHours: '07:00–23:00',
    contactName: 'Елена Орлова, администратор',
    contactPhone: '+7 900 000-01-07',
    contactNote: 'Волейбол, баскетбол, мини-футбол; аренда по часам',
  },
  {
    key: 'volna',
    name: 'Бассейн «Волна»',
    type: 'pool',
    address: 'ул. Матросова, 10',
    lat: 56.0058,
    lng: 92.857,
    workingHours: '07:00–22:00',
    contactName: 'Татьяна Дьякова, администратор',
    contactPhone: '+7 900 000-01-08',
    contactNote: 'Дорожки на 25 метров, нужна справка и сменная обувь',
  },
  {
    key: 'bereza',
    name: 'Парк «Берёзовая роща»',
    type: 'park',
    address: 'ул. Лесная, 1',
    lat: 56.018,
    lng: 92.83,
  },
  {
    key: 'dvorVesny',
    name: 'Двор на Весны',
    type: 'yard',
    address: 'ул. Весны, 23, двор',
    lat: 56.0088,
    lng: 92.839,
  },
  {
    key: 'basketDvor',
    name: 'Баскет-двор «У школы»',
    type: 'yard',
    address: 'ул. Железнодорожников, 14',
    lat: 56.0155,
    lng: 92.849,
  },
  {
    key: 'sharik',
    name: 'Клуб настольного тенниса «Шарик»',
    type: 'club',
    address: 'ул. Дубровинского, 31',
    lat: 56.0075,
    lng: 92.848,
    workingHours: '14:00–22:00',
    contactName: 'Игорь Нестеров, тренер',
    contactPhone: '+7 900 000-01-12',
    contactNote: 'Столы и ракетки в аренду',
  },
  {
    key: 'dyhanie',
    name: 'Студия йоги «Дыхание»',
    type: 'hall',
    address: 'ул. Урицкого, 52',
    lat: 56.0135,
    lng: 92.8545,
    workingHours: '08:00–21:00',
    contactName: 'Светлана Кравцова, администратор',
    contactPhone: '+7 900 000-01-13',
    contactNote: 'Коврики выдаём, группы до 15 человек',
  },
  {
    key: 'centralPark',
    name: 'Центральный парк',
    type: 'park',
    address: 'Центральный парк',
    lat: 56.0079,
    lng: 92.8531,
  },
  {
    key: 'pokrovsky',
    name: 'Покровский парк',
    type: 'park',
    address: 'Покровский парк',
    lat: 55.9596,
    lng: 92.8644,
  },
];

type OrgKey = 'chessClub' | 'runners' | 'fitness';

export const ORGANIZATIONS: {
  key: OrgKey;
  owner: UserKey;
  name: string;
  activity: string;
  description: string;
  contacts: string;
  sports: string[];
  status: 'approved' | 'pending' | 'rejected';
  rejectionReason?: string;
}[] = [
  {
    key: 'chessClub',
    owner: 'orgApproved',
    name: 'Шахматный клуб «Е2–Е4»',
    activity: 'Клуб',
    description:
      'Любительский шахматный клуб. Встречаемся в кафе и клубах города, рады новичкам: научим правилам и дадим доску.',
    contacts: 'e2e4@demo.local, +7 900 000-02-01',
    sports: ['Шахматы'],
    status: 'approved',
  },
  {
    key: 'runners',
    owner: 'orgPending',
    name: 'Беговое сообщество «Утренний пульс»',
    activity: 'Сообщество',
    description: 'Бегаем по утрам в парках Красноярска, темп для любого уровня.',
    contacts: 'pulse@demo.local',
    sports: ['Бег'],
    status: 'pending',
  },
  {
    key: 'fitness',
    owner: 'orgRejected',
    name: 'Фитнес-Плюс',
    activity: 'Компания',
    description: 'Фитнес.',
    contacts: '—',
    sports: ['Йога'],
    status: 'rejected',
    rejectionReason:
      'Не указаны контакты и не описано, какие встречи вы проводите. Дополните профиль и отправьте заявку снова.',
  },
];

/** Начало события: через days дней в time по местному времени Красноярска. */
export type When = { days: number; time: string; hours?: number };

export type SeedEvent = {
  key: string;
  title: string;
  description: string;
  sport: string;
  author: UserKey;
  organization?: OrgKey;
  when: When;
  joinMode: JoinMode;
  level: EventLevel;
  capacity?: number;
  requirements?: string;
  /** Площадка из справочника: адрес и координаты берутся из неё. */
  venue?: string;
  /** Без площадки: свой адрес и, если есть, своя точка на карте. */
  address?: string;
  point?: { lat: number; lng: number };
  placeNotes?: string;
  chatUrl?: string;
  unpublishedReason?: string;
};

export const EVENTS: SeedEvent[] = [
  {
    key: 'chessEvening',
    title: 'Шахматный вечер в кафе',
    description:
      'Играем партии с кем захотите, новичкам покажем правила. Можно просто прийти посмотреть.',
    sport: 'Шахматы',
    author: 'orgApproved',
    organization: 'chessClub',
    when: { days: 3, time: '19:00', hours: 3 },
    joinMode: 'free',
    level: 'beginner',
    capacity: 12,
    requirements: 'Ничего брать не нужно: доски и часы есть в кафе.',
    venue: 'hodKonem',
    placeNotes: 'Дальний зал, спросите шахматистов у администратора',
  },
  {
    key: 'blitz',
    title: 'Блиц-турнир клуба «Е2–Е4»',
    description: 'Турнир по швейцарской системе, 7 туров по 5 минут. Победителю — кубок клуба.',
    sport: 'Шахматы',
    author: 'orgApproved',
    organization: 'chessClub',
    when: { days: 6, time: '18:00', hours: 3 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 16,
    requirements:
      'Знать правила блица. Рейтинг не важен, но в заявке напишите, сколько лет играете.',
    venue: 'endshpil',
  },
  {
    key: 'football',
    title: 'Дворовый футбол 5×5',
    description:
      'Собираем две команды на субботу. Играем час, потом можно остаться на второй тайм.',
    sport: 'Футбол',
    author: 'user2',
    when: { days: 4, time: '11:00', hours: 2 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 10,
    requirements: 'Бутсы или кеды для искусственного газона.',
    venue: 'severnoe',
  },
  {
    key: 'morningRun',
    title: 'Утренняя пробежка в Центральном парке',
    description:
      'Лёгкий бег 5 км по аллеям, темп разговорный. Подстраиваемся под самого медленного.',
    sport: 'Бег',
    author: 'user3',
    when: { days: 2, time: '08:00', hours: 1 },
    joinMode: 'free',
    level: 'any',
    venue: 'centralPark',
    placeNotes: 'Встречаемся у главного входа',
  },
  {
    key: 'warmup',
    title: 'Зарядка во дворе',
    description: 'Двадцать минут простых упражнений для всех возрастов. Без снарядов и без спешки.',
    sport: 'Зарядка во дворе',
    author: 'user1',
    when: { days: 1, time: '07:30', hours: 0.5 },
    joinMode: 'free',
    level: 'any',
    venue: 'dvorVesny',
  },
  {
    key: 'yoga',
    title: 'Йога на поляне',
    description: 'Мягкая практика на свежем воздухе. Подходит тем, кто никогда не занимался.',
    sport: 'Йога',
    author: 'user2',
    when: { days: 5, time: '10:00', hours: 1.5 },
    joinMode: 'free',
    level: 'beginner',
    capacity: 15,
    requirements: 'Свой коврик и вода.',
    address: 'Поляна у входа в парк «Берёзовая роща», ул. Лесная',
    point: { lat: 56.0172, lng: 92.8312 },
  },
  {
    key: 'tableTennis',
    title: 'Настольный теннис: парные игры',
    description: 'Играем пары на вылет. Ракетки можно взять в клубе.',
    sport: 'Настольный теннис',
    author: 'user3',
    when: { days: 7, time: '19:00', hours: 2 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 8,
    venue: 'sharik',
  },
  {
    key: 'swimming',
    title: 'Плавание для начинающих',
    description: 'Учимся дышать и держаться на воде вместе с опытным пловцом. Маленькая группа.',
    sport: 'Плавание',
    author: 'user2',
    when: { days: 8, time: '20:00', hours: 1 },
    joinMode: 'free',
    level: 'beginner',
    capacity: 2,
    requirements: 'Справка, шапочка, сменная обувь.',
    venue: 'volna',
  },
  {
    key: 'volleyball',
    title: 'Волейбол в «Динамике»',
    description:
      'Аренда зала на два часа, играем шесть на шесть. Разбиваемся на команды по уровню.',
    sport: 'Волейбол',
    author: 'user1',
    when: { days: 5, time: '20:00', hours: 2 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 12,
    requirements: 'Сменная обувь для зала. Аренду делим поровну, около 300 ₽ с человека.',
    venue: 'dinamika',
  },
  {
    key: 'bike',
    title: 'Велопрогулка по Покровскому парку',
    description:
      'Неспешно катаемся два часа по дорожкам парка. Велосипед свой или из проката у входа.',
    sport: 'Велоспорт',
    author: 'user1',
    when: { days: 9, time: '12:00', hours: 2 },
    joinMode: 'free',
    level: 'any',
    // Без координат: только текстовый адрес — так выглядит событие, если карта недоступна.
    address: 'Сбор у главного входа в Покровский парк',
  },
  {
    key: 'nordicWalking',
    title: 'Скандинавская ходьба для всех',
    description: 'Ходим с палками час по аллеям. Покажем правильную технику, палки дадим на пробу.',
    sport: 'Скандинавская ходьба',
    author: 'user3',
    when: { days: 3, time: '09:00', hours: 1 },
    joinMode: 'free',
    level: 'any',
    address: 'Центральный парк, у фонтана',
    point: { lat: 56.0085, lng: 92.8522 },
  },
  {
    key: 'basketball',
    title: 'Баскетбол 3×3 у школы',
    description: 'Играем три на три до 21 очка. Команды собираем на месте.',
    sport: 'Баскетбол',
    author: 'user3',
    when: { days: 2, time: '18:30', hours: 1.5 },
    joinMode: 'free',
    level: 'amateur',
    capacity: 6,
    venue: 'basketDvor',
  },
  {
    key: 'spam',
    title: 'Продаю абонемент в спортзал',
    description: 'Отдам годовой абонемент недорого, пишите в личку.',
    sport: 'Баскетбол',
    author: 'user2',
    when: { days: 3, time: '12:00' },
    joinMode: 'free',
    level: 'any',
    venue: 'dinamika',
    unpublishedReason: 'Это объявление о продаже, а не совместная активность.',
  },

  // ---------- Прошедшие встречи: отзывы и надёжность (DEMO_DATA.md, «Отзывы») ----------
  {
    key: 'pastChessNight',
    title: 'Шахматы в антикафе',
    description: 'Свободные партии и разбор дебютов для новичков. Доски и часы клуба.',
    sport: 'Шахматы',
    author: 'orgApproved',
    organization: 'chessClub',
    when: { days: -10, time: '18:00', hours: 3 },
    joinMode: 'free',
    level: 'beginner',
    capacity: 12,
    venue: 'hodKonem',
  },
  {
    key: 'pastBlitz',
    title: 'Блиц-турнир: осенний этап',
    description: 'Семь туров по пять минут, швейцарская система.',
    sport: 'Шахматы',
    author: 'orgApproved',
    organization: 'chessClub',
    when: { days: -24, time: '18:00', hours: 3 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 16,
    venue: 'endshpil',
  },
  {
    key: 'pastTennis',
    title: 'Настольный теннис: вечер одиночек',
    description: 'Играем одиночные партии до 11 очков, соперников подбираем по уровню.',
    sport: 'Настольный теннис',
    author: 'user3',
    when: { days: -15, time: '19:00', hours: 2 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 8,
    venue: 'sharik',
  },
  {
    key: 'pastNordic',
    title: 'Скандинавская ходьба: первая встреча',
    description: 'Знакомство с техникой и час ходьбы по аллеям.',
    sport: 'Скандинавская ходьба',
    author: 'user3',
    when: { days: -30, time: '09:00', hours: 1 },
    joinMode: 'free',
    level: 'any',
    address: 'Центральный парк, у фонтана',
    point: { lat: 56.0085, lng: 92.8522 },
  },
  {
    key: 'pastRun',
    title: 'Вечерняя пробежка по набережной',
    description: '6 км вдоль Енисея в спокойном темпе.',
    sport: 'Бег',
    author: 'user3',
    when: { days: -2, time: '19:00', hours: 1 },
    joinMode: 'free',
    level: 'any',
    address: 'Набережная Енисея, у Коммунального моста',
    point: { lat: 56.0067, lng: 92.8705 },
  },
  {
    key: 'pastVolleyball',
    title: 'Волейбол: вечерняя игра',
    description: 'Два часа в зале, шесть на шесть.',
    sport: 'Волейбол',
    author: 'user1',
    when: { days: -1, time: '19:00', hours: 2 },
    joinMode: 'request',
    level: 'amateur',
    capacity: 12,
    venue: 'dinamika',
  },
];

/** Записи: [событие, участник, статус, сообщение организатору]. Решения по заявкам — от автора события. */
export const REGISTRATIONS: [string, UserKey, 'confirmed' | 'pending' | 'rejected', string?][] = [
  ['chessEvening', 'user2', 'confirmed'],
  ['chessEvening', 'user3', 'confirmed'],
  ['blitz', 'user2', 'pending', 'Играю три года, хочу попробовать турнир'],
  ['blitz', 'user3', 'pending', 'Играл в школьной секции, давно не практиковался'],
  ['football', 'user3', 'confirmed', 'Могу стоять на воротах'],
  ['morningRun', 'user1', 'confirmed'],
  ['morningRun', 'user2', 'confirmed'],
  ['warmup', 'user2', 'confirmed'],
  ['tableTennis', 'user1', 'pending', 'Играю в паре с коллегой, уровень средний'],
  ['tableTennis', 'user2', 'rejected', 'Хочу научиться'],
  ['swimming', 'user1', 'confirmed'],
  ['swimming', 'user3', 'confirmed'],
  ['volleyball', 'user2', 'pending', 'Играла за команду университета'],
  ['volleyball', 'user3', 'pending', 'Новичок, но очень хочу попробовать'],
  ['basketball', 'user1', 'confirmed'],
  ['spam', 'user1', 'confirmed'],
  ['pastChessNight', 'user1', 'confirmed'],
  ['pastChessNight', 'user2', 'confirmed'],
  ['pastChessNight', 'user3', 'confirmed'],
  ['pastBlitz', 'user2', 'confirmed'],
  ['pastBlitz', 'user3', 'confirmed'],
  ['pastTennis', 'user1', 'confirmed'],
  ['pastTennis', 'user2', 'confirmed'],
  ['pastNordic', 'user2', 'confirmed'],
  ['pastRun', 'user1', 'confirmed'],
  ['pastRun', 'user2', 'confirmed'],
  ['pastVolleyball', 'user2', 'confirmed'],
  ['pastVolleyball', 'user3', 'confirmed'],
];

/**
 * Отзывы о прошедших встречах. Без about — участник оценивает организатора встречи (человека
 * или клуб); с about — организатор отмечает этого участника. Нарочно не заполнено, чтобы эксперт
 * сделал сам: Иван ещё не оценил «Вечернюю пробежку» и не отметил участников «Волейбола».
 */
export type SeedReview = {
  event: string;
  author: UserKey;
  about?: UserKey;
  attended?: boolean;
  rating?: number;
  tags?: ReviewTag[];
  comment?: string;
};

export const REVIEWS: SeedReview[] = [
  // Шахматы в антикафе: обе стороны высказались, всё видно.
  {
    event: 'pastChessNight',
    author: 'orgApproved',
    about: 'user1',
    attended: true,
    rating: 5,
    tags: ['comes_on_time'],
  },
  {
    event: 'pastChessNight',
    author: 'orgApproved',
    about: 'user2',
    attended: true,
    rating: 5,
    tags: ['helps_others'],
    comment: 'Помогла новичкам разобраться с часами.',
  },
  { event: 'pastChessNight', author: 'orgApproved', about: 'user3', attended: true, rating: 4 },
  {
    event: 'pastChessNight',
    author: 'user1',
    rating: 5,
    tags: ['as_described', 'friendly'],
    comment: 'Уютно, объяснили правила блица и дали сыграть с сильными.',
  },
  { event: 'pastChessNight', author: 'user2', rating: 5, tags: ['newbie_friendly'] },
  {
    event: 'pastChessNight',
    author: 'user3',
    rating: 4,
    tags: ['friendly'],
    comment: 'Начали на 15 минут позже, но в целом здорово.',
  },
  // Блиц: Алексей не пришёл — у него неявка в надёжности.
  {
    event: 'pastBlitz',
    author: 'orgApproved',
    about: 'user2',
    attended: true,
    rating: 5,
    tags: ['keeps_word'],
  },
  {
    event: 'pastBlitz',
    author: 'orgApproved',
    about: 'user3',
    attended: false,
    comment: 'Не пришёл и не предупредил.',
  },
  {
    event: 'pastBlitz',
    author: 'user2',
    rating: 5,
    tags: ['want_more'],
    comment: 'Турнир провели чётко, хочу на следующий этап.',
  },
  // Встречи Алексея: у него как у организатора набирается оценка.
  {
    event: 'pastTennis',
    author: 'user3',
    about: 'user1',
    attended: true,
    rating: 5,
    tags: ['comes_on_time'],
  },
  { event: 'pastTennis', author: 'user3', about: 'user2', attended: true, rating: 4 },
  {
    event: 'pastTennis',
    author: 'user1',
    rating: 5,
    tags: ['as_described'],
    comment: 'Алексей подобрал соперников по уровню, никто не скучал.',
  },
  { event: 'pastTennis', author: 'user2', rating: 4, tags: ['friendly'] },
  { event: 'pastNordic', author: 'user3', about: 'user2', attended: true },
  {
    event: 'pastNordic',
    author: 'user2',
    rating: 5,
    tags: ['newbie_friendly'],
    comment: 'Показали технику и дали палки на пробу.',
  },
  // Пробежка: Алексей отметил всех, Мария оценила. Отзыв об Иване откроется, когда Иван оценит сам.
  {
    event: 'pastRun',
    author: 'user3',
    about: 'user1',
    attended: true,
    rating: 5,
    tags: ['team_player'],
    comment: 'Держал темп всей группы, спасибо!',
  },
  { event: 'pastRun', author: 'user3', about: 'user2', attended: true },
  {
    event: 'pastRun',
    author: 'user2',
    rating: 5,
    tags: ['started_on_time'],
    comment: 'Хороший темп, Алексей подождал отстающих.',
  },
  // Волейбол Ивана: Мария уже оценила, но отзыв откроется, когда Иван отметит участников.
  {
    event: 'pastVolleyball',
    author: 'user2',
    rating: 5,
    tags: ['as_described'],
    comment: 'Отличная игра, команды получились ровные.',
  },
];

export type SeedComment = {
  event: string;
  author: UserKey;
  text: string;
  replies?: { author: UserKey; text: string }[];
  hiddenReason?: string;
};

export const COMMENTS: SeedComment[] = [
  {
    event: 'chessEvening',
    author: 'user2',
    text: 'Доски будут или приносить свои?',
    replies: [
      { author: 'orgApproved', text: 'Доски и часы есть в кафе, приносить ничего не нужно.' },
    ],
  },
  {
    event: 'football',
    author: 'user1',
    text: 'Можно прийти без своей команды?',
    replies: [
      { author: 'user2', text: 'Да, команды делим на месте. Подайте заявку, я подтвержу.' },
    ],
  },
  { event: 'blitz', author: 'user3', text: 'Сколько будет туров и во сколько закончим?' },
  {
    event: 'morningRun',
    author: 'user2',
    text: 'Распродажа кроссовок со скидкой 70%, пишите в личку!',
    hiddenReason: 'Реклама, не относится к мероприятию',
  },
  { event: 'morningRun', author: 'user1', text: 'Если пойдёт дождь, пробежка будет?' },
];
