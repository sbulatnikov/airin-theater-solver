import type { TurnInput } from '@airin-play/core/shared';
import { describe, expect, it } from 'vitest';
import { engines } from './test-engines';

const player = (reply: string): TurnInput => ({ reply, type: 'controlled', outcome: 'player' });
const ai = (reply: string): TurnInput => ({ reply, type: 'anonymous', outcome: 'ai' });
const missed = (): TurnInput => ({ type: 'anonymous', outcome: 'missed' });

describe.each(engines)('%s: особые исходы хода', (_path, engine) => {
  it.each(['СС', 'ЗЗ', 'КК', 'СЗ', 'СК', 'ЗК'])('ход ИИ %s добавляет два цветовых очка и ноль восторга', (reply) => {
    const result = engine.calculateState([ai(reply)]);
    const turn = result.calculatedTurns[0];

    expect(turn).toMatchObject({ outcome: 'ai', reply, shared: 0, balance: 0, gain: 0, audienceAfter: 0 });
    expect(Object.values(result.scores).reduce((sum, value) => sum + value, 0)).toBe(2);
  });

  it('подавляет весь потенциальный восторг ИИ, но сохраняет его реплику для следующего хода', () => {
    const result = engine.calculateState([player('СС'), player('ЗК'), ai('ЗК'), player('ЗК')]);

    expect(result.calculatedTurns[2]).toMatchObject({
      outcome: 'ai',
      contribution: { blue: 0, green: 1, red: 1 },
      shared: 0,
      balance: 0,
      gain: 0,
      audienceAfter: 0,
      scoresAfter: { blue: 2, green: 2, red: 2 },
    });
    expect(result.calculatedTurns[3]).toMatchObject({ shared: 1, balance: 1, gain: 2, audienceAfter: 2 });
    expect(result.previous).toBe('ЗК');
  });

  it('не меняет цвета при пропуске, штрафует до нуля и сохраняет предыдущую реплику', () => {
    const result = engine.calculateState([player('СС'), player('СС'), missed(), player('СС')]);

    expect(result.calculatedTurns.map((turn) => turn.audienceAfter)).toEqual([0, 1, 0, 1]);
    expect(result.calculatedTurns[2]).toMatchObject({
      outcome: 'missed',
      reply: null,
      contribution: { blue: 0, green: 0, red: 0 },
      shared: 0,
      balance: 0,
      gain: -1,
      scoresAfter: { blue: 4, green: 0, red: 0 },
    });
    expect(result.calculatedTurns[3]).toMatchObject({ shared: 1, balance: 0, gain: 1 });
    expect(result.scores).toEqual({ blue: 6, green: 0, red: 0 });
    expect(result.previous).toBe('СС');
  });

  it('рассчитывает бонус баланса обычного хода после пропуска', () => {
    const result = engine.calculateState([player('СС'), missed(), player('КК')]);

    expect(result.calculatedTurns[1]).toMatchObject({ gain: 0, scoresAfter: { blue: 2, green: 0, red: 0 } });
    expect(result.calculatedTurns[2]).toMatchObject({ shared: 0, balance: 1, gain: 1, audienceAfter: 1 });
  });

  it('не опускает восторг ниже нуля при последовательных пропусках', () => {
    const result = engine.calculateState([missed(), missed(), player('СС'), player('СС'), missed(), missed()]);

    expect(result.calculatedTurns.map((turn) => turn.gain)).toEqual([0, 0, 0, 1, -1, 0]);
    expect(result.calculatedTurns.every((turn) => turn.audienceAfter >= 0)).toBe(true);
    expect(result.audience).toBe(0);
  });

  it('полностью пересчитывает отмену ИИ и пропуска из оставшейся истории', () => {
    const turns = [player('СС'), ai('КК'), missed(), player('КК')];
    const afterAi = engine.calculateState(turns.slice(0, 2));
    const afterMiss = engine.calculateState(turns.slice(0, 3));

    expect(afterMiss.scores).toEqual(afterAi.scores);
    expect(afterMiss.previous).toBe(afterAi.previous);
    expect(engine.calculateState(turns.slice(0, -2))).toEqual(afterAi);
    expect(engine.calculateState(turns.slice(0, -3))).toEqual(engine.calculateState([player('СС')]));
  });

  it('отклоняет несовместимые данные особого исхода', () => {
    expect(() => engine.calculateState([{ type: 'anonymous', outcome: 'ai' }])).toThrow(TypeError);
    expect(() => engine.calculateState([{ reply: 'СС', type: 'anonymous', outcome: 'missed' }])).toThrow(TypeError);
    expect(() =>
      engine.calculateState([{ reply: 'СС', type: 'anonymous', outcome: 'unknown' as TurnInput['outcome'] }]),
    ).toThrow(TypeError);
  });

  it('завершает смешанную пьесу на 16-м ходу и отклоняет 17-й', () => {
    const turns = Array.from({ length: 16 }, (_, index) =>
      index % 3 === 0 ? ai('СС') : index % 3 === 1 ? missed() : player('КК'),
    );

    expect(engine.calculateState(turns).calculatedTurns).toHaveLength(16);
    expect(() => engine.calculateState([...turns, missed()])).toThrow(RangeError);
  });

  it('сохраняет обратную совместимость истории без outcome', () => {
    const legacy: TurnInput[] = [
      { reply: 'СС', type: 'controlled' },
      { reply: 'ЗК', type: 'anonymous' },
    ];
    const explicit = legacy.map((turn) => ({ ...turn, outcome: 'player' as const }));

    expect(engine.calculateState(legacy)).toEqual(engine.calculateState(explicit));
  });
});
