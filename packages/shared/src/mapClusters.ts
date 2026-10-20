// Группы меток на карте: метки, которые на экране налезают друг на друга, собираются в одну
// «группу» с числом встреч. Владелец: участник 2. Карта — apps/web/src/modules/org/map.
//
// Точки — в пикселях карты на текущем масштабе (Leaflet map.project), а не в градусах:
// налезают метки или нет, решает расстояние на экране. Группы зависят только от масштаба,
// поэтому при сдвиге карты не перестраиваются.

export type ScreenPoint<T> = { x: number; y: number; item: T };

/** Группа: центр (среднее её точек) и всё, что в неё попало, в исходном порядке. */
export type PointGroup<T> = { x: number; y: number; items: T[] };

/**
 * Один проход: первая свободная группа забирает все свободные в радиусе от себя, центр новой
 * группы — среднее всех её точек (с весом по их числу).
 */
function mergePass<T>(groups: PointGroup<T>[], radius: number): PointGroup<T>[] {
  const taken = groups.map(() => false);
  const limit = radius * radius;
  const merged: PointGroup<T>[] = [];
  groups.forEach((seed, i) => {
    if (taken[i]) return;
    taken[i] = true;
    const members = [seed];
    for (let j = i + 1; j < groups.length; j++) {
      if (taken[j]) continue;
      const dx = groups[j].x - seed.x;
      const dy = groups[j].y - seed.y;
      if (dx * dx + dy * dy <= limit) {
        taken[j] = true;
        members.push(groups[j]);
      }
    }
    const weight = members.reduce((sum, group) => sum + group.items.length, 0);
    merged.push({
      x: members.reduce((sum, group) => sum + group.x * group.items.length, 0) / weight,
      y: members.reduce((sum, group) => sum + group.y * group.items.length, 0) / weight,
      items: members.flatMap((group) => group.items),
    });
  });
  return merged;
}

/**
 * Группировка: проходы повторяются, пока что-то сливается. После первого прохода центр группы
 * сдвигается, и соседняя метка может налезть уже на неё — следующий проход забирает и её.
 * В итоге никакие две метки или группы не ближе radius пикселей. Порядок входа задаёт результат,
 * поэтому вход стоит сортировать одинаково (по id): тогда при перерисовке группы те же.
 * Для десятков меток — мгновенно.
 */
export function groupNearby<T>(points: ScreenPoint<T>[], radius: number): PointGroup<T>[] {
  let groups: PointGroup<T>[] = points.map(({ x, y, item }) => ({ x, y, items: [item] }));
  for (;;) {
    const merged = mergePass(groups, radius);
    if (merged.length === groups.length) return merged;
    groups = merged;
  }
}
