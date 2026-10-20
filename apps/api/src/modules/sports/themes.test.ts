// Тема своего вида спорта по названию (packages/shared/src/sportThemes.ts, участник 2):
// от неё зависит иконка в чипах, плитках формы, профиле и на метках карты.
import { sportSlug } from '@sport/shared/schemas/sports';
import { SPORT_THEME_LABELS, sportTheme } from '@sport/shared/sportThemes';
import { describe, expect, it } from 'vitest';

const themeOf = (name: string) => sportTheme(sportSlug(name));

describe('sportTheme', () => {
  it.each([
    ['Шашки', 'chess'],
    ['Верховая езда с профессионалом', 'horse'],
    ['утр пробежка', 'run'],
    ['Скандинавская ходьба', 'walk'],
    ['Большой теннис', 'tennis'],
    ['Пинг-понг', 'pingPong'],
    ['Настольный теннис', 'pingPong'],
    ['Настольные игры', 'dice'],
    ['Мафия', 'dice'],
    ['Кикбоксинг', 'fight'],
    ['Бокс', 'fight'],
    ['Стрельба из лука', 'target'],
    ['Беговые лыжи', 'snow'],
    ['Горные лыжи', 'snow'],
    ['Катание на коньках', 'iceSkate'],
    ['Хоккей', 'iceSkate'],
    ['Ролики', 'skate'],
    ['Горный велосипед', 'bike'],
    ['Велопрогулка', 'bike'],
    ['SUP-прогулка', 'kayak'],
    ['Йога на сапах', 'yoga'],
    ['Плавание в открытой воде', 'wave'],
    ['Пляжный волейбол', 'ball'],
    ['Американский футбол', 'rugby'],
    ['Кибер-футбол', 'gamepad'],
    ['Танцы', 'music'],
    ['Утренняя гимнастика', 'sun'],
    ['Утренняя пробежка', 'run'],
    ['Спортивная гимнастика', 'stretch'],
    ['Воркаут', 'dumbbell'],
    ['Тяжёлая атлетика', 'dumbbell'],
    ['Рыбалка', 'fish'],
    ['Поход выходного дня', 'hike'],
    ['Скалолазание', 'mount'],
    ['Го', 'chess'],
  ])('«%s» → %s', (name, theme) => {
    expect(themeOf(name)).toBe(theme);
  });

  it('незнакомое название — без темы, остаётся общая иконка', () => {
    expect(themeOf('Квиддич')).toBeNull();
    expect(themeOf('Городской квест')).toBeNull();
  });

  it('слово темы — только начало слова названия, а не его середина', () => {
    // «го» — целое слово (игра го), а не начало «Городской»; «конь» не ловит «коньки».
    expect(themeOf('Городской квест')).not.toBe('chess');
    expect(themeOf('Коньки')).toBe('iceSkate');
  });

  it('у каждой темы есть подпись для подсказки в форме', () => {
    expect(SPORT_THEME_LABELS.horse).toBe('конный спорт');
    expect(Object.values(SPORT_THEME_LABELS).every((label) => label.length > 0)).toBe(true);
  });
});
