import { isStrategySolverEngine } from "@airin-play/core/shared";
import engineV1, { Engine as EngineFromV1 } from "@airin-play/core/v1";
import engineV2, { Engine as EngineFromV2 } from "@airin-play/core/v2";
import { describe, expect, it } from "vitest";
import manifestV1 from "../../core/v1/package.json";
import manifestV2 from "../../core/v2/package.json";

describe("версионные пути движка", () => {
  it("экспортируют класс с одинаковым именем Engine", () => {
    expect(EngineFromV1.name).toBe("Engine");
    expect(EngineFromV2.name).toBe("Engine");
    expect(engineV1).toBeInstanceOf(EngineFromV1);
    expect(engineV2).toBeInstanceOf(EngineFromV2);
  });

  it("получают SemVer из package.json каталога версии", () => {
    expect(engineV1.version).toBe(manifestV1.version);
    expect(engineV2.version).toBe(manifestV2.version);
    expect(engineV1.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(engineV2.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("не хранят имя поколения в состоянии класса", () => {
    expect("generation" in engineV1).toBe(false);
    expect("generation" in engineV2).toBe(false);
  });

  it("предоставляют API победной цепочки только через путь v2", () => {
    expect(isStrategySolverEngine(engineV1)).toBe(false);
    expect(isStrategySolverEngine(engineV2)).toBe(true);
    expect("buildIdealChain" in engineV1).toBe(false);
  });
});
