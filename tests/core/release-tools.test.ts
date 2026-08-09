import { describe, expect, it } from 'vitest';
import { finalizeUnreleased } from '../../scripts/changelog.ts';
import { nextCandidateNumber, stableTags } from '../../scripts/rc/naming.ts';
import { releaseKindForBranches, shouldReleaseForBranches } from '../../scripts/release/release-policy.ts';
import { parseGithubRepository } from '../../scripts/shared/github.ts';

describe('release tools', () => {
  it('parses common GitHub origin URL formats', () => {
    expect(parseGithubRepository('git@github.com:sbulatnikov/airin-theater-solver.git')).toBe(
      'sbulatnikov/airin-theater-solver',
    );
    expect(parseGithubRepository('https://github.com/sbulatnikov/airin-theater-solver.git')).toBe(
      'sbulatnikov/airin-theater-solver',
    );
    expect(() => parseGithubRepository('https://github.com/owner/repository?token=leak')).toThrow(
      'Некорректный Github repository',
    );
  });

  it('chooses the next unused candidate number for the latest stable release', () => {
    expect(nextCandidateNumber('2026.1', ['origin/rc/2026.1-rc.1', '2026.1-rc.3', '2025.2-rc.9'])).toBe(4);
    expect(stableTags('2026.1-rc.1\n2026.1\ninvalid\n2026.1.2')).toEqual(['2026.1', '2026.1.2']);
  });

  it('moves Unreleased entries into a dated stable section and opens a new Unreleased section', () => {
    const changelog = `# Changelog

## Unreleased

### Добавлено

- Обучение.

## 2026.1 — 2026-08-09

- Первый релиз.
`;
    expect(finalizeUnreleased(changelog, '2026.2', '2026-09-15')).toBe(`# Changelog

## Unreleased

## 2026.2 — 2026-09-15

### Добавлено

- Обучение.

## 2026.1 — 2026-08-09

- Первый релиз.
`);
  });

  it('rejects an empty Unreleased section', () => {
    expect(() => finalizeUnreleased('# Changelog\n\n## Unreleased\n', '2026.2', '2026-09-15')).toThrow(
      'должен содержать',
    );
  });

  it('skips application releases for docs and CI-only merges', () => {
    expect(shouldReleaseForBranches(['docs/readme'])).toBe(false);
    expect(shouldReleaseForBranches(['ci/cache', 'docs/workflow'])).toBe(false);
    expect(shouldReleaseForBranches([])).toBe(false);
    expect(shouldReleaseForBranches(['hotfix/scoring'])).toBe(true);
    expect(shouldReleaseForBranches(['rc/2026.1-rc.1', 'feat/tutorial'])).toBe(true);
  });

  it('classifies accumulated changes with the safest release precedence', () => {
    expect(releaseKindForBranches(['docs/readme', 'ci/cache'])).toBe('none');
    expect(releaseKindForBranches(['hotfix/scoring', 'docs/runbook'])).toBe('hotfix');
    expect(releaseKindForBranches(['feat/tutorial', 'hotfix/scoring'])).toBe('feature');
    expect(releaseKindForBranches(['rc/2026.1.1-rc.1', 'feat/tutorial'])).toBe('prepared');
    expect(releaseKindForBranches(['dependabot/npm_and_yarn/vue'])).toBe('feature');
  });
});
