// Запросы панели организатора (задача 2.7). Владелец: участник 2. Контракт — docs/api/organizations.md,
// раздел 2. Решения по заявкам принимает сервис записи участника 1, здесь только вызовы.
import type {
  Decision,
  OrganizerRegistration,
  OrganizerRegistrations,
} from '@sport/shared/schemas/registrations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';

const panelKey = (eventId: string) => ['organizer', eventId] as const;

/** Все записи события: вкладки фильтруются на месте, счётчики приходят с сервера. */
export function useEventRegistrations(eventId: string) {
  return useQuery({
    queryKey: panelKey(eventId),
    queryFn: () => api<OrganizerRegistrations>(`/events/${eventId}/organizer/registrations`),
  });
}

export function useDecideRegistration(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, decision }: { registrationId: string; decision: Decision }) =>
      api<OrganizerRegistration>(
        `/events/${eventId}/organizer/registrations/${registrationId}/decision`,
        { method: 'POST', json: { decision } },
      ),
    onSettled: () => {
      // И при отказе (место заняли, заявку отозвали) список устарел.
      void queryClient.invalidateQueries({ queryKey: panelKey(eventId) });
      // Число участников и имена в карточке события, счётчик заявок в «Моих мероприятиях».
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
