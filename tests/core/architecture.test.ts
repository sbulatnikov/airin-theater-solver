import { isStrategySolverEngine } from '@airin-play/core/shared';
import engineV2, { Engine as EngineFromV2 } from '@airin-play/core/v2';
import { describe, expect, it } from 'vitest';
import coreManifest from '../../core/package.json';
import manifestV2 from '../../core/v2/package.json';

describe('публичный API движка', () => {
  it('экспортирует класс Engine и готовый экземпляр через путь v2', () => {
    expect(EngineFromV2.name).toBe('Engine');
    expect(engineV2).toBeInstanceOf(EngineFromV2);
  });

  it('получает SemVer из package.json каталога версии', () => {
    expect(engineV2.version).toBe(manifestV2.version);
    expect(engineV2.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('не хранит имя поколения в состоянии класса', () => {
    expect('generation' in engineV2).toBe(false);
  });

  it('предоставляет API победной цепочки', () => {
    expect(isStrategySolverEngine(engineV2)).toBe(true);
  });

  it('не публикует удалённую точку входа v1', () => {
    expect(Object.keys(coreManifest.exports)).not.toContain('./v1');
  });
});
