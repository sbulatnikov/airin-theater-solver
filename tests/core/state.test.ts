import { describe, expect, it } from "vitest";
import { asTurns, engines } from "./test-engines";

describe.each(engines)("%s: расчёт состояния", (_path, engine) => {
  it.each(["СС", "ЗЗ", "КК", "СЗ", "СК", "ЗК"])("первая реплика %s всегда даёт ноль восторга", (reply) => {
    const result = engine.calculateState(asTurns([reply]));
    expect(result.audience).toBe(0);
    expect(result.calculatedTurns[0]?.gain).toBe(0);
  });

  it("считает равенство 2–0–2 без бонуса общего цвета", () => {
    const result = engine.calculateState(asTurns(["СС", "КК"]));
    expect(result.scores).toEqual({ blue: 2, green: 0, red: 2 });
    expect(result.calculatedTurns[1]).toMatchObject({ shared: 0, balance: 1, gain: 1 });
    expect(result.audience).toBe(1);
  });

  it("игнорирует равенство на единице, сохраняя +1 за общий цвет", () => {
    const result = engine.calculateState(asTurns(["ЗК", "СЗ"]));
    expect(result.scores).toEqual({ blue: 1, green: 2, red: 1 });
    expect(result.calculatedTurns[1]).toMatchObject({ shared: 1, balance: 0, gain: 1 });
  });

  it("может начислить +2 за тройное равенство без общего цвета", () => {
    const result = engine.calculateState(asTurns(["СК", "ЗЗ", "СК"]));
    expect(result.scores).toEqual({ blue: 2, green: 2, red: 2 });
    expect(result.calculatedTurns[2]).toMatchObject({ shared: 0, balance: 2, gain: 2 });
  });

  it("ограничивает максимум хода тремя очками восторга", () => {
    const result = engine.calculateState(asTurns(["СС", "ЗК", "ЗК"]));
    expect(result.scores).toEqual({ blue: 2, green: 2, red: 2 });
    expect(result.calculatedTurns[2]).toMatchObject({ shared: 1, balance: 2, gain: 3 });
    expect(Math.max(...result.calculatedTurns.map((turn) => turn.gain))).toBe(3);
  });

  it("не зависит от порядка букв внутри двуцветных реплик", () => {
    const direct = engine.calculateState(asTurns(["КЗ", "СЗ", "КС"]));
    const reversed = engine.calculateState(asTurns(["ЗК", "ЗС", "СК"]));
    expect(reversed.scores).toEqual(direct.scores);
    expect(reversed.audience).toBe(direct.audience);
    expect(reversed.calculatedTurns.map((turn) => turn.gain)).toEqual(direct.calculatedTurns.map((turn) => turn.gain));
  });

  it("полностью пересчитывает состояние и не меняет входные данные", () => {
    const turns = asTurns(["СС", "ЗК", "ЗК", "СК"]);
    const before = structuredClone(turns);
    expect(engine.calculateState(turns)).toEqual(engine.calculateState(turns));
    expect(turns).toEqual(before);
    expect(engine.calculateState(turns.slice(0, -1))).toEqual(engine.calculateState(before.slice(0, -1)));
  });

  it("нормализует допустимые реплики на публичной границе", () => {
    const result = engine.calculateState([{ reply: "ck", type: "anonymous" }]);
    expect(result.previous).toBe("СК");
    expect(result.calculatedTurns[0]?.reply).toBe("СК");
  });

  it("отклоняет некорректную и слишком длинную историю", () => {
    expect(() => engine.calculateState([{ reply: "УК", type: "anonymous" }])).toThrow(TypeError);
    expect(() => engine.calculateState(asTurns(Array.from({ length: 17 }, () => "СС")))).toThrow(RangeError);
  });
});
