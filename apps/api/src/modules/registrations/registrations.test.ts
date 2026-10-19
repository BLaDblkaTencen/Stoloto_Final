import {
  decisionSchema,
  joinBodySchema,
  myRegistrationsQuerySchema,
} from '@sport/shared/schemas/registrations';
import { describe, expect, it } from 'vitest';

describe('тело записи', () => {
  it('без тела и с пустым сообщением — запись без сообщения', () => {
    expect(joinBodySchema.parse(undefined)).toEqual({ message: null });
    expect(joinBodySchema.parse(null)).toEqual({ message: null });
    expect(joinBodySchema.parse({ message: '   ' })).toEqual({ message: null });
  });

  it('сообщение организатору обрезается по краям и ограничено 500 символами', () => {
    expect(joinBodySchema.parse({ message: '  Играю за клуб  ' })).toEqual({
      message: 'Играю за клуб',
    });
    expect(joinBodySchema.safeParse({ message: 'а'.repeat(501) }).success).toBe(false);
  });
});

describe('«Мои записи» и решения', () => {
  it('по умолчанию — предстоящие, первая страница', () => {
    expect(myRegistrationsQuerySchema.parse({})).toEqual({
      scope: 'upcoming',
      limit: 20,
      offset: 0,
    });
  });

  it('решение — только принять или отклонить', () => {
    expect(decisionSchema.parse({ decision: 'confirm' })).toEqual({ decision: 'confirm' });
    expect(decisionSchema.safeParse({ decision: 'approve' }).success).toBe(false);
  });
});
