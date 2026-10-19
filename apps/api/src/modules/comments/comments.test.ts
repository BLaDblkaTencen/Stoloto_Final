import { createCommentSchema } from '@sport/shared/schemas/comments';
import { describe, expect, it } from 'vitest';

describe('сообщение в обсуждении', () => {
  it('текст обрезается по краям, ответ — с parentId', () => {
    expect(createCommentSchema.parse({ text: '  Будут ли мячи?  ' })).toEqual({
      text: 'Будут ли мячи?',
    });
    const parentId = '7f3c2c1e-5a4b-4c3d-9e2f-1a2b3c4d5e6f';
    expect(createCommentSchema.parse({ text: 'Да', parentId }).parentId).toBe(parentId);
  });

  it('пустое и слишком длинное сообщение не принимаются', () => {
    expect(createCommentSchema.safeParse({ text: '   ' }).error?.issues[0]?.message).toBe(
      'Напишите сообщение',
    );
    expect(createCommentSchema.safeParse({ text: 'а'.repeat(1001) }).success).toBe(false);
    expect(createCommentSchema.safeParse({ text: 'Да', parentId: 'abc' }).success).toBe(false);
  });
});
