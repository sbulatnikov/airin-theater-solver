import { describe, expect, it } from 'vitest';
import { assertChangelogRelease, planMainRelease } from '../../scripts/release/main-release.ts';

describe('automatic main release', () => {
  it('prepares the next functional release for an unversioned feature merge', () => {
    expect(planMainRelease('2026.1.1', '2026.1.1', 'feature', 2026)).toEqual({
      prepareRepository: true,
      release: '2026.2',
    });
  });

  it('reuses an already prepared functional release without another commit', () => {
    expect(planMainRelease('2026.1.1', '2026.2.0', 'feature', 2026)).toEqual({
      prepareRepository: false,
      release: '2026.2',
    });
  });

  it('prepares only the next patch for a direct hotfix', () => {
    expect(planMainRelease('2026.1.1', '2026.1.1', 'hotfix', 2026)).toEqual({
      prepareRepository: true,
      release: '2026.1.2',
    });
  });

  it('validates the version already assigned by an RC', () => {
    expect(planMainRelease('2026.1.1', '2026.2.0', 'prepared', 2026)).toEqual({
      prepareRepository: false,
      release: '2026.2',
    });
    expect(() => planMainRelease('2026.1.1', '2026.1.1', 'prepared', 2026)).toThrow();
  });

  it('rejects an unrelated repository version', () => {
    expect(() => planMainRelease('2026.1.1', '2027.3.0', 'feature', 2026)).toThrow('должны выпустить 2026.2');
  });

  it('requires a dated changelog section when no automatic commit is needed', () => {
    expect(() => assertChangelogRelease('## 2026.2 — 2026-08-09\n', '2026.2')).not.toThrow();
    expect(() => assertChangelogRelease('## Unreleased\n', '2026.2')).toThrow('датированный раздел 2026.2');
  });
});
