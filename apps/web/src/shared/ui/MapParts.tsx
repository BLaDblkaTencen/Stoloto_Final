// Части карты и «Места встречи»: попап события, карточка площадки, запасное состояние.
// Логику карты (Leaflet, фильтры, выбор места) пишет участник 2; здесь только внешний вид.
import { VENUE_TYPE_LABELS, type VenueType } from '@sport/shared';
import type { ReactNode } from 'react';
import { Badge } from './Badge';
import { Button, buttonClass } from './Button';
import { Icon } from './Icon';
import { venueTypeIcon } from './map';

/**
 * Содержимое попапа события на карте (в react-leaflet — внутри <Popup>):
 * цветная шапка с видом спорта и режимом записи, ниже сведения и кнопки.
 */
export function MapPopupCard({
  color,
  sport,
  badge,
  title,
  children,
  actions,
}: {
  /** Цвет шапки: sportColor(slug). */
  color: string;
  sport: string;
  /** Обычно <JoinModeBadge mode={…} />. */
  badge?: ReactNode;
  title: string;
  /** Дата, место, уровень, места, организатор — по строке. */
  children: ReactNode;
  /** Две кнопки: «Подробнее» и «Записаться» / «Подать заявку». */
  actions?: ReactNode;
}) {
  return (
    <div className="bg-surface text-ink">
      <div
        // pr-10: справа место под круглую кнопку закрытия попапа (map.css).
        className="flex items-center justify-between gap-2 border-b-2 border-ink py-2.5 pr-10 pl-3.5 font-semibold"
        style={{ background: color }}
      >
        <span>{sport}</span>
        {badge}
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="font-display text-[19px] leading-tight font-bold">{title}</div>
        <div className="flex flex-col gap-1 text-ink-muted">{children}</div>
        {actions && <div className="mt-1.5 flex gap-2 [&>*]:flex-1">{actions}</div>}
      </div>
    </div>
  );
}

/** Площадка в форме, которую отдаёт API участника 2 (лишние поля не мешают). */
export type VenueCardData = {
  name: string;
  type: VenueType;
  address: string;
  description?: string | null;
  workingHours?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactNote?: string | null;
};

/** «+7 900 000-01-01» → «tel:+79000000101». */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * Карточка площадки «Место встречи»: что за место и с кем договориться.
 * В форме события, в карточке события и в попапе карты (compact).
 */
export function VenueCard({ venue, compact = false }: { venue: VenueCardData; compact?: boolean }) {
  const hasContact = venue.contactName || venue.contactPhone;
  return (
    <div
      className={`flex flex-col gap-3 ${compact ? 'p-3.5 pr-10' : 'rounded-lg border-2 border-ink bg-surface p-5 shadow-md'}`}
    >
      <div className="flex flex-col gap-1.5">
        <div>
          <Badge tone="plain" icon={venueTypeIcon(venue.type)}>
            {VENUE_TYPE_LABELS[venue.type]}
          </Badge>
        </div>
        <div className="font-display text-[20px] leading-tight font-bold">{venue.name}</div>
        <div className="flex items-start gap-1.5">
          <Icon name="pin" size={20} className="mt-0.5" />
          {venue.address}
        </div>
        {venue.workingHours && (
          <div className="flex items-start gap-1.5">
            <Icon name="clock" size={20} className="mt-0.5" />
            {venue.workingHours}
          </div>
        )}
        {!compact && venue.description && <p className="text-ink-muted">{venue.description}</p>}
      </div>

      {hasContact ? (
        <div className="flex flex-col gap-2 rounded-md border-2 border-ink bg-status-success p-3.5">
          <div className="font-semibold">С кем договориться</div>
          {venue.contactName && <div>{venue.contactName}</div>}
          {venue.contactPhone && (
            // Телефон — крупной кнопкой: на телефоне сразу звонит.
            <a
              href={telHref(venue.contactPhone)}
              className={buttonClass('primary', 'md', 'self-start')}
            >
              <Icon name="phone" size={20} />
              Позвонить {venue.contactPhone}
            </a>
          )}
          {venue.contactNote && <div className="text-ink-muted">{venue.contactNote}</div>}
        </div>
      ) : (
        <div className="text-ink-muted">Открытое место: договариваться не нужно.</div>
      )}
    </div>
  );
}

/** Карта не загрузилась: адрес каждого события указан текстом, основной сценарий работает. */
export function MapUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="status"
      className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 bg-surface-muted p-8 text-center"
    >
      <Icon name="map" size={48} strokeWidth={1.8} />
      <strong className="font-display text-[22px]">Карта недоступна</strong>
      <span>Адрес каждой встречи указан текстом в списке.</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Попробовать снова
        </Button>
      )}
    </div>
  );
}
