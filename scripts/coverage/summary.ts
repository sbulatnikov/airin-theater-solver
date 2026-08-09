import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const startMarker = '<!-- coverage:start -->';
const endMarker = '<!-- coverage:end -->';
const minimumCoverage = 90;
const metricNames = ['statements', 'branches', 'functions', 'lines'] as const;

type CoverageMetricName = (typeof metricNames)[number];

export interface CoverageMetric {
  covered: number;
  pct: number;
  skipped: number;
  total: number;
}

export type CoverageSummary = Record<CoverageMetricName, CoverageMetric>;
export type CoverageMode = '--check' | '--github-summary' | '--write';

export interface SynchronizeCoverageOptions {
  githubSummaryPath?: string;
  mode: CoverageMode;
  readmePath: string;
  summaryPath: string;
}

interface CoverageSummaryFile {
  total?: Partial<Record<CoverageMetricName, unknown>>;
}

export function parseCoverageSummary(value: unknown): CoverageSummary {
  const total = (value as CoverageSummaryFile | null)?.total;
  if (!total || typeof total !== 'object') throw new Error('coverage-summary.json не содержит объект total.');

  return Object.fromEntries(
    metricNames.map((name) => {
      const metric = total[name] as Partial<CoverageMetric> | undefined;
      if (!metric || typeof metric !== 'object') throw new Error(`В coverage summary отсутствует метрика ${name}.`);
      for (const field of ['covered', 'pct', 'skipped', 'total'] as const) {
        if (typeof metric[field] !== 'number' || !Number.isFinite(metric[field])) {
          throw new Error(`Метрика ${name}.${field} должна быть конечным числом.`);
        }
      }
      const validated = metric as CoverageMetric;
      if (validated.pct < 0 || validated.pct > 100 || validated.covered < 0 || validated.total < validated.covered) {
        throw new Error(`Метрика ${name} содержит некорректные значения.`);
      }
      return [name, validated];
    }),
  ) as unknown as CoverageSummary;
}

export function coverageTable(summary: CoverageSummary): string {
  const labels: Record<CoverageMetricName, string> = {
    statements: 'Statements',
    branches: 'Branches',
    functions: 'Functions',
    lines: 'Lines',
  };
  const rows = metricNames.map(
    (name) => `| ${labels[name]} | ${summary[name].pct.toFixed(2)}% | ${minimumCoverage}% |`,
  );
  return ['| Метрика | Покрытие | Минимум |', '| --- | ---: | ---: |', ...rows].join('\n');
}

export function coverageBlock(summary: CoverageSummary): string {
  return `${startMarker}\n${coverageTable(summary)}\n${endMarker}`;
}

export function replaceCoverageBlock(readme: string, block: string): string {
  const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
  const matches = readme.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`README должен содержать ровно один coverage marker-блок, найдено: ${matches.length}.`);
  }
  return readme.replace(pattern, block);
}

export async function readCoverageSummary(path: string): Promise<CoverageSummary> {
  return parseCoverageSummary(JSON.parse(await readFile(path, 'utf8')));
}

export function coverageMode(value: string | undefined): CoverageMode {
  if (value !== '--check' && value !== '--write' && value !== '--github-summary') {
    throw new Error('Использование: tsx scripts/coverage/summary.ts <--check|--write|--github-summary>.');
  }
  return value;
}

export async function synchronizeCoverage(options: SynchronizeCoverageOptions): Promise<void> {
  const summary = await readCoverageSummary(options.summaryPath);
  const { mode } = options;
  if (mode === '--github-summary') {
    const output = options.githubSummaryPath;
    if (!output) throw new Error('Для --github-summary требуется GITHUB_STEP_SUMMARY.');
    await appendFile(output, `## Unit coverage\n\n${coverageTable(summary)}\n`, 'utf8');
    return;
  }

  const readme = await readFile(options.readmePath, 'utf8');
  const expected = replaceCoverageBlock(readme, coverageBlock(summary));
  if (mode === '--write') {
    await writeFile(options.readmePath, expected, 'utf8');
    return;
  }
  if (readme !== expected) {
    throw new Error('Значения coverage в README устарели. Выполните `pnpm coverage:update`.');
  }
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, '../..');
  await synchronizeCoverage({
    mode: coverageMode(process.argv[2]),
    readmePath: resolve(root, 'README.md'),
    summaryPath: resolve(root, 'coverage/coverage-summary.json'),
    githubSummaryPath: process.env.GITHUB_STEP_SUMMARY,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
