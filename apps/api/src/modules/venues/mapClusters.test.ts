// Группы меток карты (packages/shared/src/mapClusters.ts): налезающие на экране метки — одна группа.
import { groupNearby } from '@sport/shared/mapClusters';
import { describe, expect, it } from 'vitest';

const point = (id: string, x: number, y: number) => ({ x, y, item: id });

describe('groupNearby', () => {
  it('далёкие метки остаются по одной', () => {
    const groups = groupNearby([point('a', 0, 0), point('b', 100, 0), point('c', 0, 100)], 40);
    expect(groups.map((group) => group.items)).toEqual([['a'], ['b'], ['c']]);
  });

  it('налезающие метки — одна группа с центром посередине', () => {
    const groups = groupNearby([point('a', 0, 0), point('b', 30, 0), point('c', 300, 300)], 40);
    expect(groups).toEqual([
      { x: 15, y: 0, items: ['a', 'b'] },
      { x: 300, y: 300, items: ['c'] },
    ]);
  });

  it('метки в одной точке (встречи на одной площадке) — одна группа', () => {
    const groups = groupNearby([point('a', 10, 10), point('b', 10, 10), point('c', 10, 10)], 40);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toEqual(['a', 'b', 'c']);
  });

  it('метка, на которую налезла сдвинувшаяся группа, тоже попадает в неё', () => {
    // a и b — группа с центром 15; c в 55 от a, но всего в 40 от центра группы.
    const groups = groupNearby([point('a', 0, 0), point('b', 30, 0), point('c', 55, 0)], 40);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toEqual(['a', 'b', 'c']);
    expect(groups[0].x).toBeCloseTo(85 / 3);
  });

  it('после группировки никакие две метки или группы не ближе радиуса', () => {
    const points = Array.from({ length: 40 }, (_, i) =>
      point(`e${i}`, (i * 37) % 300, (i * 53) % 200),
    );
    const groups = groupNearby(points, 45);
    for (const [i, a] of groups.entries()) {
      for (const b of groups.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(45);
      }
    }
  });

  it('радиус включительно, дальше — отдельно', () => {
    expect(groupNearby([point('a', 0, 0), point('b', 40, 0)], 40)).toHaveLength(1);
    expect(groupNearby([point('a', 0, 0), point('b', 40.5, 0)], 40)).toHaveLength(2);
  });

  it('каждая метка попадает ровно в одну группу', () => {
    const points = Array.from({ length: 30 }, (_, i) =>
      point(`e${i}`, (i * 17) % 120, (i * 29) % 90),
    );
    const groups = groupNearby(points, 35);
    const all = groups.flatMap((group) => group.items).sort();
    expect(all).toEqual(points.map((p) => p.item).sort());
  });

  it('тот же вход — те же группы: карта не перестраивает их при перерисовке', () => {
    const points = [point('a', 0, 0), point('b', 20, 5), point('c', 45, 0), point('d', 200, 0)];
    expect(groupNearby(points, 30)).toEqual(groupNearby([...points], 30));
  });
});
