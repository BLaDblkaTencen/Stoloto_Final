import type { RegistrationStatus } from '@sport/shared';
import { describe, expect, it } from 'vitest';
import {
  canSeeChat,
  canSeeEvent,
  canSeeParticipants,
  cancelDenial,
  eventPermissions,
  joinDenial,
  type RuleEvent,
  type Viewer,
} from './rules';

const now = new Date('2026-10-20T10:00:00Z');
const tomorrow = new Date('2026-10-21T12:00:00Z');
const yesterday = new Date('2026-10-19T12:00:00Z');

const event = (patch: Partial<RuleEvent> = {}): RuleEvent => ({
  status: 'published',
  startsAt: tomorrow,
  createdBy: 'author',
  joinMode: 'free',
  capacity: null,
  registrationClosed: false,
  ...patch,
});

const author: Viewer = { id: 'author', role: 'user' };
const user: Viewer = { id: 'u2', role: 'user' };
const org: Viewer = { id: 'org', role: 'organization' };
const admin: Viewer = { id: 'admin', role: 'admin' };

const denialCode = (
  e: RuleEvent,
  viewer: Viewer,
  my: RegistrationStatus | null = null,
  participants = 0,
) => joinDenial(e, viewer, my, participants, now)?.code ?? null;

describe('кто может записаться', () => {
  it('обычный пользователь на опубликованное предстоящее событие — да', () => {
    expect(denialCode(event(), user)).toBeNull();
    expect(denialCode(event({ joinMode: 'request' }), user)).toBeNull();
  });

  it('без входа — просим войти', () => {
    expect(joinDenial(event(), null, null, 0, now)).toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('на снятое и удалённое нельзя, в том числе по прямой ссылке', () => {
    expect(denialCode(event({ status: 'unpublished' }), user)).toBe('EVENT_UNAVAILABLE');
    expect(denialCode(event({ status: 'deleted' }), user)).toBe('EVENT_UNAVAILABLE');
  });

  it('на прошедшее и на своё нельзя', () => {
    expect(denialCode(event({ startsAt: yesterday }), user)).toBe('EVENT_PAST');
    expect(denialCode(event(), author)).toBe('OWN_EVENT');
  });

  it('организация и админ не записываются', () => {
    expect(denialCode(event(), org)).toBe('FORBIDDEN');
    expect(denialCode(event(), admin)).toBe('FORBIDDEN');
  });

  it('повторно нельзя, после отказа — тоже, после отмены — можно', () => {
    expect(denialCode(event(), user, 'confirmed')).toBe('ALREADY_REGISTERED');
    expect(joinDenial(event(), user, 'pending', 0, now)?.message).toBe('Заявка уже отправлена');
    expect(denialCode(event(), user, 'rejected')).toBe('REGISTRATION_REJECTED');
    expect(denialCode(event(), user, 'cancelled')).toBeNull();
  });

  it('лимит мест: последнее место можно занять, сверх лимита — нет', () => {
    expect(denialCode(event({ capacity: 3 }), user, null, 2)).toBeNull();
    expect(denialCode(event({ capacity: 3 }), user, null, 3)).toBe('EVENT_FULL');
    expect(denialCode(event({ capacity: null }), user, null, 500)).toBeNull();
  });

  it('организатор закрыл запись: новых нет, записанным — прежний ответ, отменить можно', () => {
    const closed = event({ registrationClosed: true });
    expect(denialCode(closed, user)).toBe('REGISTRATION_CLOSED');
    expect(denialCode(event({ registrationClosed: true, joinMode: 'request' }), user)).toBe(
      'REGISTRATION_CLOSED',
    );
    expect(denialCode(closed, user, 'cancelled')).toBe('REGISTRATION_CLOSED');
    expect(denialCode(closed, user, 'confirmed')).toBe('ALREADY_REGISTERED');
    expect(cancelDenial(closed, 'confirmed', now)).toBeNull();
    expect(eventPermissions(closed, user, null, 0, now).canJoin).toBe(false);
  });
});

describe('отмена записи', () => {
  it('отменить можно подтверждённую и ожидающую, в том числе на снятом событии', () => {
    expect(cancelDenial(event(), 'confirmed', now)).toBeNull();
    expect(cancelDenial(event({ status: 'unpublished' }), 'pending', now)).toBeNull();
  });

  it('нечего отменять или событие прошло', () => {
    expect(cancelDenial(event(), null, now)?.code).toBe('NOT_REGISTERED');
    expect(cancelDenial(event(), 'rejected', now)?.code).toBe('NOT_REGISTERED');
    expect(cancelDenial(event({ startsAt: yesterday }), 'confirmed', now)?.code).toBe('EVENT_PAST');
  });
});

describe('видимость', () => {
  it('снятое событие видят только организатор, админ и записавшиеся', () => {
    const hidden = event({ status: 'unpublished' });
    expect(canSeeEvent(hidden, null, null)).toBe(false);
    expect(canSeeEvent(hidden, user, null)).toBe(false);
    expect(canSeeEvent(hidden, user, 'pending')).toBe(true);
    expect(canSeeEvent(hidden, author, null)).toBe(true);
    expect(canSeeEvent(hidden, admin, null)).toBe(true);
  });

  it('имена участников события по заявке — организатору и подтверждённым', () => {
    const byRequest = event({ joinMode: 'request' });
    expect(canSeeParticipants(event(), null, null)).toBe(true);
    expect(canSeeParticipants(byRequest, null, null)).toBe(false);
    expect(canSeeParticipants(byRequest, user, 'pending')).toBe(false);
    expect(canSeeParticipants(byRequest, user, 'confirmed')).toBe(true);
    expect(canSeeParticipants(byRequest, author, null)).toBe(true);
  });

  it('ссылку на чат видят подтверждённые и организатор', () => {
    expect(canSeeChat(event(), user, 'pending')).toBe(false);
    expect(canSeeChat(event(), user, 'confirmed')).toBe(true);
    expect(canSeeChat(event(), author, null)).toBe(true);
  });
});

describe('права в карточке', () => {
  it('автор правит своё предстоящее событие и не может на него записаться', () => {
    expect(eventPermissions(event(), author, null, 0, now)).toEqual({
      isOrganizer: true,
      canEdit: true,
      canJoin: false,
      canCancel: false,
      canComment: true,
    });
  });

  it('снятое и прошедшее событие не правится, под снятым не пишут', () => {
    expect(eventPermissions(event({ status: 'unpublished' }), author, null, 0, now)).toMatchObject({
      canEdit: false,
      canComment: false,
    });
    expect(eventPermissions(event({ startsAt: yesterday }), author, null, 0, now).canEdit).toBe(
      false,
    );
  });

  it('аноним только смотрит', () => {
    expect(eventPermissions(event(), null, null, 0, now)).toEqual({
      isOrganizer: false,
      canEdit: false,
      canJoin: false,
      canCancel: false,
      canComment: false,
    });
  });
});
