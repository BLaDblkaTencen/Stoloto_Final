import { describe, expect, it } from 'vitest';
import { DomainError } from '../../lib/domain-error';
import {
  assertCanCreateOrganization,
  buildResubmitChanges,
  normalizeOrgName,
  orgNameKey,
  selectOrganizationView,
  toOrganizationOwner,
  toOrganizationPublic,
} from './lifecycle';
import { resolvePublishingOrganization } from './publish-access';
import type { ActingUser, OrganizationReader, OrganizationRecord } from './types';

function makeOrg(patch: Partial<OrganizationRecord> = {}): OrganizationRecord {
  return {
    id: 'org-1',
    ownerId: 'user-org',
    name: 'Шахматный клуб «Ладья»',
    description: 'Играем в шахматы по субботам',
    activity: 'клуб',
    city: 'Красноярск',
    contacts: 'club@example.test',
    status: 'pending',
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-10-01T10:00:00Z'),
    ...patch,
  };
}

const readerOf = (org: OrganizationRecord | null): OrganizationReader => ({
  findByOwnerId: async () => org,
});

const orgUser: ActingUser = { id: 'user-org', role: 'organization' };

async function errorOf(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error('Ожидалась ошибка DomainError, но её не было');
}

function errorOfSync(fn: () => unknown): DomainError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error('Ожидалась ошибка DomainError, но её не было');
}

describe('resolvePublishingOrganization (2.6)', () => {
  it('допущенная организация: возвращает её id', async () => {
    const org = makeOrg({ status: 'approved' });
    await expect(resolvePublishingOrganization(readerOf(org), orgUser)).resolves.toEqual({
      organizationId: 'org-1',
    });
  });

  it('организации нет: 404 ORG_NOT_FOUND', async () => {
    const err = await errorOf(resolvePublishingOrganization(readerOf(null), orgUser));
    expect([err.status, err.code]).toEqual([404, 'ORG_NOT_FOUND']);
  });

  it('заявка на рассмотрении: 403 ORG_NOT_APPROVED', async () => {
    const err = await errorOf(resolvePublishingOrganization(readerOf(makeOrg()), orgUser));
    expect([err.status, err.code]).toEqual([403, 'ORG_NOT_APPROVED']);
    expect(err.message).toContain('на рассмотрении');
  });

  it('отклонённая заявка: в сообщении причина отказа', async () => {
    const org = makeOrg({ status: 'rejected', rejectionReason: 'Нет описания деятельности' });
    const err = await errorOf(resolvePublishingOrganization(readerOf(org), orgUser));
    expect([err.status, err.code]).toEqual([403, 'ORG_NOT_APPROVED']);
    expect(err.message).toContain('Нет описания деятельности');
  });

  it('отклонённая заявка без причины: сообщение без хвоста «null»', async () => {
    const org = makeOrg({ status: 'rejected', rejectionReason: '  ' });
    const err = await errorOf(resolvePublishingOrganization(readerOf(org), orgUser));
    expect(err.message).not.toMatch(/null|undefined/);
  });

  it('админ: 403 WRONG_ROLE, организацию даже не ищем', async () => {
    let called = false;
    const reader: OrganizationReader = {
      findByOwnerId: async () => {
        called = true;
        return null;
      },
    };
    const err = await errorOf(
      resolvePublishingOrganization(reader, { id: 'admin-1', role: 'admin' }),
    );
    expect([err.status, err.code]).toEqual([403, 'WRONG_ROLE']);
    expect(called).toBe(false);
  });

  it('обычный пользователь: 403 WRONG_ROLE', async () => {
    const err = await errorOf(
      resolvePublishingOrganization(readerOf(makeOrg({ status: 'approved' })), {
        id: 'user-1',
        role: 'user',
      }),
    );
    expect([err.status, err.code]).toEqual([403, 'WRONG_ROLE']);
  });
});

describe('создание организации и повторная подача', () => {
  it('аккаунт организации без организации: можно создать', () => {
    expect(() => assertCanCreateOrganization(orgUser, null)).not.toThrow();
  });

  it('вторая организация у того же аккаунта: 409 ORG_ALREADY_EXISTS', () => {
    const err = errorOfSync(() => assertCanCreateOrganization(orgUser, makeOrg()));
    expect([err.status, err.code]).toEqual([409, 'ORG_ALREADY_EXISTS']);
  });

  it.each(['user', 'admin'] as const)('роль %s: 403 WRONG_ROLE', (role) => {
    const err = errorOfSync(() => assertCanCreateOrganization({ id: 'x', role }, null));
    expect([err.status, err.code]).toEqual([403, 'WRONG_ROLE']);
  });

  it('повторная подача из rejected: pending, причина и решение очищены', () => {
    const org = makeOrg({
      status: 'rejected',
      rejectionReason: 'Мало данных',
      reviewedBy: 'admin-1',
      reviewedAt: new Date('2026-10-02T10:00:00Z'),
    });
    expect(buildResubmitChanges(org)).toEqual({
      status: 'pending',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it.each(['pending', 'approved'] as const)(
    'повторная подача из %s: 409 ORG_NOT_REJECTED',
    (status) => {
      const err = errorOfSync(() => buildResubmitChanges(makeOrg({ status })));
      expect([err.status, err.code]).toEqual([409, 'ORG_NOT_REJECTED']);
    },
  );
});

describe('кто что видит', () => {
  const owner: ActingUser = { id: 'user-org', role: 'organization' };
  const stranger: ActingUser = { id: 'user-2', role: 'user' };
  const admin: ActingUser = { id: 'admin-1', role: 'admin' };

  it('допущенная: аноним и посторонний видят публичный вид', () => {
    const org = makeOrg({ status: 'approved' });
    expect(selectOrganizationView(org, null)).toBe('public');
    expect(selectOrganizationView(org, stranger)).toBe('public');
  });

  it('допущенная: владелец и админ видят расширенный вид', () => {
    const org = makeOrg({ status: 'approved' });
    expect(selectOrganizationView(org, owner)).toBe('owner');
    expect(selectOrganizationView(org, admin)).toBe('owner');
  });

  it.each(['pending', 'rejected'] as const)(
    '%s: аноним и посторонний получают 404, владелец и админ видят',
    (status) => {
      const org = makeOrg({ status });
      for (const viewer of [null, stranger]) {
        const err = errorOfSync(() => selectOrganizationView(org, viewer));
        expect([err.status, err.code]).toEqual([404, 'ORG_NOT_FOUND']);
      }
      expect(selectOrganizationView(org, owner)).toBe('owner');
      expect(selectOrganizationView(org, admin)).toBe('owner');
    },
  );

  it('публичный вид не содержит статуса, причины и владельца', () => {
    const dto = toOrganizationPublic(makeOrg({ status: 'approved' }), []);
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('rejectionReason');
    expect(dto).not.toHaveProperty('ownerId');
    expect(dto.createdAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('вид владельца: причина отказа есть только у rejected', () => {
    const rejected = toOrganizationOwner(
      makeOrg({ status: 'rejected', rejectionReason: 'Мало данных' }),
      [],
    );
    expect(rejected.rejectionReason).toBe('Мало данных');

    const approved = toOrganizationOwner(
      makeOrg({ status: 'approved', rejectionReason: 'остаток от прошлой заявки' }),
      [],
    );
    expect(approved.rejectionReason).toBeNull();
  });

  it('виды спорта попадают в оба вида', () => {
    const sports = [{ id: 's1', name: 'Шахматы', slug: 'шахматы' }];
    expect(toOrganizationPublic(makeOrg(), sports).sports).toEqual(sports);
    expect(toOrganizationOwner(makeOrg(), sports).sports).toEqual(sports);
  });
});

describe('название организации', () => {
  it('убирает лишние пробелы, регистр сохраняет', () => {
    expect(normalizeOrgName('  Клуб   «Ладья »  ')).toBe('Клуб «Ладья »');
  });

  it('ключ сравнения не зависит от регистра и пробелов', () => {
    expect(orgNameKey('Клуб  Ладья')).toBe(orgNameKey(' клуб ладья '));
    expect(orgNameKey('Клуб Ладья')).not.toBe(orgNameKey('Клуб Ладья 2'));
  });
});
