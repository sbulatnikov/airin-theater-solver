import { describe, expect, it } from 'vitest';
import {
  formatReleaseNotes,
  generateReleaseNotes,
  includesReleaseNotes,
  parseReleaseLog,
  pullRequestNumber,
  type ReleaseChange,
  type ReleaseCommit,
  type ReleasePullRequestReader,
  resolvePullRequest,
  skipsReleaseNotes,
} from '../../scripts/release/release-notes.ts';

const commit = (overrides: Partial<ReleaseCommit> = {}): ReleaseCommit => ({
  sha: '1234567890abcdef',
  subject: 'fix(ci): repair release pipeline (#6)',
  body: '',
  ...overrides,
});

const change = (overrides: Partial<ReleaseChange> = {}): ReleaseChange => ({
  commit: commit(),
  pullRequest: {
    number: 6,
    title: 'Repair release pipeline',
    state: 'open',
    draft: false,
    html_url: 'https://github.com/sbulatnikov/airin-theater-solver/pull/6',
    head: { ref: 'hotfix/release-pipeline', sha: '1234567890abcdef' },
    base: { ref: 'main' },
    user: { id: 42, login: 'backend', html_url: 'https://github.com/backend' },
  },
  ...overrides,
});

const pullRequest = change().pullRequest;

function githubReader(overrides: Partial<ReleasePullRequestReader> = {}): ReleasePullRequestReader {
  return {
    repository: 'sbulatnikov/airin-theater-solver',
    getPullRequest: async () => pullRequest,
    getPullRequestsForCommit: async () => [],
    ...overrides,
  };
}

describe('release notes', () => {
  it('parses machine-delimited git log records', () => {
    const log =
      '1234567890abcdef\u001ffix: first (#6)\u001fBody\u001e\nabcdef1234567890\u001ffeat: second (#7)\u001f\u001e';
    expect(parseReleaseLog(log)).toEqual([
      { sha: '1234567890abcdef', subject: 'fix: first (#6)', body: 'Body' },
      { sha: 'abcdef1234567890', subject: 'feat: second (#7)', body: '' },
    ]);
    expect(() => parseReleaseLog('sha-only')).toThrow('неполную запись');
  });

  it('recognizes explicit PR references and release housekeeping', () => {
    expect(pullRequestNumber(commit())).toBe(6);
    expect(pullRequestNumber(commit({ subject: 'fix: pipeline', body: 'Pull-Request: #17' }))).toBe(17);
    expect(pullRequestNumber(commit({ subject: 'fix: resolve #42', body: '' }))).toBeUndefined();
    expect(
      pullRequestNumber(
        commit({
          subject: 'fix: pipeline',
          body: 'https://github.com/sbulatnikov/airin-theater-solver/pull/19',
        }),
      ),
    ).toBe(19);
    expect(pullRequestNumber(commit({ subject: 'fix: pipeline', body: 'Source-PR: #21' }))).toBe(21);
    expect(skipsReleaseNotes(commit({ body: 'Release-Notes: skip' }))).toBe(true);
  });

  it('resolves a PR explicitly referenced by the commit', async () => {
    let requestedNumber = 0;
    const resolved = await resolvePullRequest(
      commit(),
      githubReader({
        getPullRequest: async (number) => {
          requestedNumber = number;
          return pullRequest;
        },
      }),
    );

    expect(requestedNumber).toBe(6);
    expect(resolved).toBe(pullRequest);
  });

  it('falls back to the PR associated with a merge-preserved commit', async () => {
    const resolved = await resolvePullRequest(
      commit({ subject: 'wip(automation): harden clients' }),
      githubReader({ getPullRequestsForCommit: async () => [pullRequest] }),
    );

    expect(resolved).toBe(pullRequest);
  });

  it('rejects missing and ambiguous PR associations', async () => {
    const unresolved = commit({ subject: 'fix: missing association' });
    await expect(resolvePullRequest(unresolved, githubReader())).rejects.toThrow('не связан с PR в main');
    await expect(
      resolvePullRequest(
        unresolved,
        githubReader({
          getPullRequestsForCommit: async () => [
            pullRequest,
            { ...pullRequest, number: 7, html_url: 'https://github.com/example/repository/pull/7' },
          ],
        }),
      ),
    ).rejects.toThrow('связан с несколькими PR в main (#6, #7)');
  });

  it('creates a Change Log with commit, PR and contributor links', () => {
    expect(formatReleaseNotes([change()], 'sbulatnikov/airin-theater-solver')).toBe(`# Change Log

- [\`1234567\`](https://github.com/sbulatnikov/airin-theater-solver/commit/1234567890abcdef) fix(ci): repair release pipeline ([#6](https://github.com/sbulatnikov/airin-theater-solver/pull/6)) — [@backend](https://github.com/backend)
`);
    expect(() => formatReleaseNotes([], 'owner/repository')).toThrow('нет публикуемых изменений');
    expect(() => formatReleaseNotes([change()], 'invalid repository')).toThrow('Некорректный GitHub repository');
  });

  it('keeps documentation and CI commits out of the user-facing Change Log', () => {
    expect(includesReleaseNotes({ ...pullRequest, head: { ...pullRequest.head, ref: 'ci/release' } })).toBe(false);
    expect(includesReleaseNotes({ ...pullRequest, head: { ...pullRequest.head, ref: 'docs/readme' } })).toBe(false);
    expect(includesReleaseNotes({ ...pullRequest, head: { ...pullRequest.head, ref: 'feat/tutorial' } })).toBe(true);
  });

  it('generates notes from Git history while skipping housekeeping and CI pull requests', async () => {
    const feature = change({
      commit: commit({ sha: 'aaaaaaaaaaaaaaa', subject: 'feat: tutorial (#6)' }),
    });
    const ciPullRequest = { ...pullRequest, number: 7, head: { ref: 'ci/cache', sha: 'bbbbbbbbbbbbbbb' } };
    const github = githubReader({
      getPullRequest: async (number) => (number === 6 ? feature.pullRequest : ciPullRequest),
    });
    const git = {
      log: () =>
        [
          'aaaaaaaaaaaaaaa\u001ffeat: tutorial (#6)\u001f\u001e',
          'bbbbbbbbbbbbbbb\u001fci: cache (#7)\u001f\u001e',
          'ccccccccccccccc\u001fchore(release): prepare 2026.2\u001fRelease-Notes: skip\u001e',
        ].join(''),
    };

    await expect(generateReleaseNotes('2026.1', 'main', github, git as never)).resolves.toContain('feat: tutorial');
    const notes = await generateReleaseNotes('2026.1', 'main', github, git as never);
    expect(notes).not.toContain('ci: cache');
    expect(notes).not.toContain('prepare 2026.2');
  });
});
