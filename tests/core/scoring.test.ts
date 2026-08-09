import type { Scores } from '@airin-play/core/shared';
import { describe, expect, it } from 'vitest';
import { engines } from './test-engines';

const zero: Scores = { blue: 0, green: 0, red: 0 };

describe.each(engines)('%s: элементарные правила очков', (_path, engine) => {
  it.each([
    ['СС', { blue: 2, green: 0, red: 0 }],
    ['ЗЗ', { blue: 0, green: 2, red: 0 }],
    ['КК', { blue: 0, green: 0, red: 2 }],
    ['СЗ', { blue: 1, green: 1, red: 0 }],
    ['ЗС', { blue: 1, green: 1, red: 0 }],
    ['СК', { blue: 1, green: 0, red: 1 }],
    ['КС', { blue: 1, green: 0, red: 1 }],
    ['ЗК', { blue: 0, green: 1, red: 1 }],
    ['КЗ', { blue: 0, green: 1, red: 1 }],
  ])('реплика %s добавляет ровно два цветовых очка', (reply, expected) => {
    const contribution = engine.replyContribution(reply);
    expect(contribution).toEqual(expected);
    expect(contribution.blue + contribution.green + contribution.red).toBe(2);
  });

  it.each([
    ['СС', 'СЗ', true],
    ['КЗ', 'СК', true],
    ['СЗ', 'ЗК', true],
    ['СС', 'КК', false],
    ['ЗЗ', 'СК', false],
  ])('определяет общий цвет для %s → %s', (previous, current, expected) => {
    expect(engine.hasSharedColor(previous, current)).toBe(expected);
  });

  it('не находит общий цвет без предыдущей реплики', () => {
    expect(engine.hasSharedColor(null, 'СС')).toBe(false);
  });

  it('не даёт бонус равенства на единице', () => {
    expect(engine.balanceBonus({ blue: 1, green: 2, red: 1 }, { blue: 1, green: 1, red: 0 })).toBe(0);
  });

  it('даёт +1 за затронутую равную пару со значением не меньше двух', () => {
    expect(engine.balanceBonus({ blue: 2, green: 0, red: 2 }, { blue: 0, green: 0, red: 2 })).toBe(1);
  });

  it('не даёт бонус за равную пару, которую текущая реплика не затронула', () => {
    expect(engine.balanceBonus({ blue: 2, green: 2, red: 3 }, { blue: 0, green: 0, red: 2 })).toBe(0);
  });

  it('даёт только +2 за равенство трёх цветов, не суммируя пары', () => {
    expect(engine.balanceBonus({ blue: 2, green: 2, red: 2 }, { blue: 1, green: 1, red: 0 })).toBe(2);
  });

  it('возвращает ноль для пустого вклада', () => {
    expect(engine.balanceBonus({ blue: 2, green: 2, red: 2 }, zero)).toBe(0);
  });
});
