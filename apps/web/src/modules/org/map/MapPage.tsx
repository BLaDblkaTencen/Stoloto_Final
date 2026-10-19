// Страница /map «Встречи на карте»: киллер-фича отдельно от ленты. Встречи и, по желанию,
// площадки с контактами: с карты можно сразу создать встречу на выбранной площадке.
import { JOIN_MODES, JOIN_MODE_LABELS, type JoinMode } from '@sport/shared';
import { useSearchParams } from 'react-router';
import { Chip, SportChip } from '../../../shared/ui';
import { useSports } from '../api';
import { EventsMap } from './EventsMap';

export function MapPage() {
  const [params, setParams] = useSearchParams();
  const sportId = params.get('sport') ?? undefined;
  const joinMode = (params.get('mode') as JoinMode | null) ?? undefined;
  const showVenues = params.get('venues') === '1';
  const sports = useSports();

  const toggle = (key: string, value: string, current: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value === current) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h2 mb-2">Встречи на карте</h1>
        <p className="text-ink-muted">
          Метка — встреча, цвет — вид спорта, замок — запись по заявке. Нажмите на метку, чтобы
          увидеть подробности.
          {showVenues &&
            `${
              sportId
                ? ' Круглые метки — площадки, жёлтые подходят этому виду спорта.'
                : ' Круглые метки — площадки: кафе, клубы, поля и парки.'
            } В карточке площадки — с кем договориться и какие встречи там уже проходят.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5" aria-label="Вид спорта">
        {sports.data?.map((sport, index) => (
          <SportChip
            key={sport.id}
            sport={sport}
            index={index}
            pressed={sport.id === sportId}
            onClick={() => toggle('sport', sport.id, sportId)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2.5" aria-label="Режим записи и площадки">
        {JOIN_MODES.map((mode) => (
          <Chip
            key={mode}
            pressed={mode === joinMode}
            icon={mode === 'request' ? 'lock' : 'door'}
            onClick={() => toggle('mode', mode, joinMode)}
          >
            {JOIN_MODE_LABELS[mode]}
          </Chip>
        ))}
        <Chip
          pressed={showVenues}
          icon="house"
          index={2}
          onClick={() => toggle('venues', '1', showVenues ? '1' : undefined)}
        >
          Площадки
        </Chip>
      </div>

      <EventsMap
        filters={{ sportId, joinMode }}
        showVenues={showVenues}
        className="h-[60vh] min-h-[420px]"
      />
    </div>
  );
}
