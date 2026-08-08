import { isStrategySolverEngine } from "@airin-play/core/shared";
import engineV1 from "@airin-play/core/v1";
import engineV2 from "@airin-play/core/v2";
import { describe, expect, it } from "vitest";
import { asTurns, engines } from "./test-engines";

describe.each(engines)("%s: анализ доступных вариантов", (_path, engine) => {
  it("анализирует только переданный набор", () => {
    const options = ["СС", "СК", "ЗК"];
    const results = engine.analyzeOptions([], options);
    expect(results.map((result) => result.reply)).toEqual(options);
    expect(results).toHaveLength(3);
  });

  it("помечает лучшими ровно варианты с максимальной проекцией", () => {
    const results = engine.analyzeOptions(asTurns(["СС", "ЗК"]), ["СС", "СК", "ЗК"]);
    const maximum = Math.max(...results.map((result) => result.projectedGain));
    expect(results.filter((result) => result.isBest).length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.isBest).toBe(result.projectedGain === maximum);
    }
  });

  it("не прогнозирует будущие очки, когда ходов не осталось", () => {
    expect(engine.bestFutureGain({ blue: 4, green: 4, red: 4 }, "СК", 0)).toBe(0);
  });
});

describe("@airin-play/core/v2: победная цепочка", () => {
  it("отсутствует по пути v1", () => {
    expect(isStrategySolverEngine(engineV1)).toBe(false);
  });

  it("строит 16 допустимых ходов с нулём восторга на первом", () => {
    const route = engineV2.buildIdealChain([]);
    expect(route.steps).toHaveLength(16);
    expect(route.steps[0]?.gain).toBe(0);
    expect(route.steps.every((step) => engineV2.replyTypes.includes(step.reply))).toBe(true);
    expect(route.steps.every((step) => step.gain >= 0 && step.gain <= 3)).toBe(true);
    expect(route.finalAudience).toBe(route.steps.reduce((sum, step) => sum + step.gain, 0));
  });

  it("находит маршрут, достигающий цели 26", () => {
    const route = engineV2.buildIdealChain([]);
    expect(route.finalAudience).toBeGreaterThanOrEqual(engineV2.targetScore);
    expect(route.canWin).toBe(true);
  });

  it("продолжает маршрут с правильного номера после истории", () => {
    const history = asTurns(["СС", "КК"]);
    const current = engineV2.calculateState(history);
    const route = engineV2.buildIdealChain(history);
    expect(route.steps).toHaveLength(14);
    expect(route.steps[0]?.number).toBe(3);
    expect(route.finalAudience).toBeGreaterThanOrEqual(current.audience);
  });

  it("детерминированно строит одну и ту же цепочку", () => {
    const history = asTurns(["СС", "ЗК", "ЗК"]);
    expect(engineV2.buildIdealChain(history)).toEqual(engineV2.buildIdealChain(history));
  });
});
