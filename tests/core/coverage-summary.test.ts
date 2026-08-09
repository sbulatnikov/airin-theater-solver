import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  coverageBlock,
  coverageMode,
  coverageTable,
  parseCoverageSummary,
  replaceCoverageBlock,
  synchronizeCoverage,
} from '../../scripts/coverage/summary.ts';

const rawSummary = {
  total: {
    statements: { total: 100, covered: 97, skipped: 0, pct: 97 },
    branches: { total: 100, covered: 91, skipped: 0, pct: 90.79 },
    functions: { total: 100, covered: 98, skipped: 0, pct: 98.5 },
    lines: { total: 100, covered: 99, skipped: 0, pct: 98.6 },
  },
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture(): Promise<{ githubSummaryPath: string; readmePath: string; summaryPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'airin-coverage-test-'));
  temporaryDirectories.push(root);
  const readmePath = join(root, 'README.md');
  const summaryPath = join(root, 'coverage-summary.json');
  const githubSummaryPath = join(root, 'github-summary.md');
  await writeFile(readmePath, '# Project\n\n<!-- coverage:start -->\nold\n<!-- coverage:end -->\n', 'utf8');
  await writeFile(summaryPath, JSON.stringify(rawSummary), 'utf8');
  await writeFile(githubSummaryPath, '# CI\n', 'utf8');
  return { githubSummaryPath, readmePath, summaryPath };
}

describe('coverage summary', () => {
  it('parses Vitest output and renders stable two-decimal Markdown', () => {
    const summary = parseCoverageSummary(rawSummary);

    expect(coverageTable(summary)).toContain('| Branches | 90.79% | 90% |');
    expect(coverageTable(summary)).toContain('| Functions | 98.50% | 90% |');
    expect(coverageBlock(summary)).toMatch(/^<!-- coverage:start -->/);
  });

  it('updates exactly one README marker block', () => {
    const block = coverageBlock(parseCoverageSummary(rawSummary));
    const readme = '# Project\n\n<!-- coverage:start -->\nold\n<!-- coverage:end -->\n';

    expect(replaceCoverageBlock(readme, block)).toContain('| Statements | 97.00% | 90% |');
    expect(() => replaceCoverageBlock('# Missing\n', block)).toThrow('найдено: 0');
    expect(() => replaceCoverageBlock(`${readme}\n${readme}`, block)).toThrow('найдено: 2');
  });

  it('rejects incomplete, non-finite, and contradictory summaries', () => {
    expect(() => parseCoverageSummary({})).toThrow('объект total');
    expect(() => parseCoverageSummary({ total: {} })).toThrow('отсутствует метрика statements');
    expect(() =>
      parseCoverageSummary({
        ...rawSummary,
        total: { ...rawSummary.total, branches: { ...rawSummary.total.branches, pct: Number.NaN } },
      }),
    ).toThrow('конечным числом');
    expect(() =>
      parseCoverageSummary({
        ...rawSummary,
        total: { ...rawSummary.total, lines: { ...rawSummary.total.lines, covered: 101 } },
      }),
    ).toThrow('некорректные значения');
  });

  it('writes, checks, and rejects stale README coverage values', async () => {
    const paths = await fixture();

    await synchronizeCoverage({ ...paths, mode: '--write' });
    await expect(synchronizeCoverage({ ...paths, mode: '--check' })).resolves.toBeUndefined();
    await writeFile(paths.readmePath, '<!-- coverage:start -->\nstale\n<!-- coverage:end -->\n', 'utf8');
    await expect(synchronizeCoverage({ ...paths, mode: '--check' })).rejects.toThrow('устарели');
  });

  it('appends a table to the GitHub Step Summary and requires its path', async () => {
    const paths = await fixture();

    await synchronizeCoverage({ ...paths, mode: '--github-summary' });
    await expect(readFile(paths.githubSummaryPath, 'utf8')).resolves.toContain('## Unit coverage');
    await expect(
      synchronizeCoverage({
        mode: '--github-summary',
        readmePath: paths.readmePath,
        summaryPath: paths.summaryPath,
      }),
    ).rejects.toThrow('GITHUB_STEP_SUMMARY');
  });

  it('validates the CLI mode', () => {
    expect(coverageMode('--write')).toBe('--write');
    expect(coverageMode('--check')).toBe('--check');
    expect(coverageMode('--github-summary')).toBe('--github-summary');
    expect(() => coverageMode(undefined)).toThrow('Использование');
    expect(() => coverageMode('--unknown')).toThrow('Использование');
  });
});
