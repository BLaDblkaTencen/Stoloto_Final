import {
  createOrganizationBody,
  organizationListQuery,
  updateOrganizationBody,
} from '@sport/shared/schemas/organizations';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/errors';
import {
  checkPublishing,
  orgNameKey,
  resubmitChanges,
  selectView,
  toOwner,
  toPublic,
  type OrganizationRow,
  type Viewer,
} from './rules';

const SPORT_ID = '0b9f8a4e-1c2d-4e5f-9a6b-7c8d9e0f1a2b';

function makeOrg(patch: Partial<OrganizationRow> = {}): OrganizationRow {
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
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    ...patch,
  };
}

function appError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('Ожидалась AppError');
}

describe('checkPublishing (2.6)', () => {
  it('допущенная: id и название для подписи организатора', () => {
    expect(checkPublishing(makeOrg({ status: 'approved' }))).toEqual({
      organizationId: 'org-1',
      name: 'Шахматный клуб «Ладья»',
    });
  });

  it('организации нет: 404 ORG_NOT_FOUND с подсказкой подать заявку', () => {
    const err = appError(() => checkPublishing(null));
    expect([err.status, err.code]).toEqual([404, 'ORG_NOT_FOUND']);
    expect(err.message).toContain('подайте заявку');
  });

  it.each([
    ['на рассмотрении', makeOrg(), 'на рассмотрении'],
    ['отклонена', makeOrg({ status: 'rejected', rejectionReason: 'Нет описания' }), 'Нет описания'],
  ])('%s: 403 ORG_NOT_APPROVED с понятным текстом', (_name, org, text) => {
    const err = appError(() => checkPublishing(org));
    expect([err.status, err.code]).toEqual([403, 'ORG_NOT_APPROVED']);
    expect(err.message).toContain(text);
  });

  it('отклонена без причины: текст без «null»', () => {
    const err = appError(() => checkPublishing(makeOrg({ status: 'rejected' })));
    expect(err.message).not.toMatch(/null|undefined/);
  });
});

describe('повторная подача', () => {
  it('из rejected: pending, решение очищено', () => {
    const org = makeOrg({
      status: 'rejected',
      rejectionReason: 'Мало данных',
      reviewedBy: 'admin-1',
      reviewedAt: new Date(),
    });
    expect(resubmitChanges(org)).toEqual({
      status: 'pending',
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it.each(['pending', 'approved'] as const)('из %s: 409 ORG_NOT_REJECTED', (status) => {
    const err = appError(() => resubmitChanges(makeOrg({ status })));
    expect([err.status, err.code]).toEqual([409, 'ORG_NOT_REJECTED']);
  });
});

describe('кто что видит', () => {
  const owner: Viewer = { id: 'user-org', role: 'organization' };
  const stranger: Viewer = { id: 'user-2', role: 'user' };
  const admin: Viewer = { id: 'admin-1', role: 'admin' };

  it('допущенная: всем публичный вид, владельцу и админу расширенный', () => {
    const org = makeOrg({ status: 'approved' });
    expect([null, stranger].map((v) => selectView(org, v))).toEqual(['public', 'public']);
    expect([owner, admin].map((v) => selectView(org, v))).toEqual(['owner', 'owner']);
  });

  it.each(['pending', 'rejected'] as const)('%s: чужим 404, владельцу и админу видна', (status) => {
    const org = makeOrg({ status });
    for (const viewer of [null, stranger]) {
      const err = appError(() => selectView(org, viewer));
      expect([err.status, err.code]).toEqual([404, 'ORG_NOT_FOUND']);
    }
    expect(selectView(org, owner)).toBe('owner');
    expect(selectView(org, admin)).toBe('owner');
  });

  it('публичный вид без статуса, причины и владельца', () => {
    const dto = toPublic(makeOrg({ status: 'approved' }), []);
    expect(Object.keys(dto)).not.toContain('status');
    expect(Object.keys(dto)).not.toContain('rejectionReason');
    expect(Object.keys(dto)).not.toContain('ownerId');
    expect(dto.createdAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('причина отказа видна только у rejected', () => {
    const rejected = makeOrg({ status: 'rejected', rejectionReason: 'Мало данных' });
    expect(toOwner(rejected, []).rejectionReason).toBe('Мало данных');
    const approved = makeOrg({ status: 'approved', rejectionReason: 'старая причина' });
    expect(toOwner(approved, []).rejectionReason).toBeNull();
  });
});

describe('схемы запросов', () => {
  const valid = {
    name: '  Клуб   «Ладья»  ',
    description: 'Играем в шахматы по субботам',
    activity: 'клуб',
    city: '',
    sportIds: [SPORT_ID, SPORT_ID],
  };

  it('создание: название без лишних пробелов, пустой город — null, дубли видов спорта убраны', () => {
    const body = createOrganizationBody.parse(valid);
    expect(body.name).toBe('Клуб «Ладья»');
    expect(body.city).toBeNull();
    expect(body.sportIds).toEqual([SPORT_ID]);
  });

  it('создание: ошибки по полям на русском', () => {
    const result = createOrganizationBody.safeParse({ ...valid, name: 'А', sportIds: [] });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['name', 'sportIds']));
  });

  it('правка: пустое тело не принимается, частичное — да', () => {
    expect(updateOrganizationBody.safeParse({}).success).toBe(false);
    expect(updateOrganizationBody.parse({ contacts: '+7 900 000-00-00' })).toEqual({
      contacts: '+7 900 000-00-00',
    });
  });

  it('список: значения по умолчанию и числа из строки запроса', () => {
    expect(organizationListQuery.parse({})).toEqual({ limit: 20, offset: 0 });
    expect(organizationListQuery.parse({ limit: '5', offset: '10' })).toMatchObject({
      limit: 5,
      offset: 10,
    });
    expect(organizationListQuery.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('ключ названия не зависит от регистра и пробелов', () => {
    expect(orgNameKey(' Клуб  ЛАДЬЯ ')).toBe(orgNameKey('клуб ладья'));
  });
});
