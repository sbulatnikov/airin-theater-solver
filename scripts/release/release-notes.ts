import type { GitClient } from '../shared/git.ts';
import type { GithubPullRequest } from '../shared/github.ts';
import { releaseKindForBranches } from './release-policy.ts';

export interface ReleaseCommit {
  sha: string;
  subject: string;
  body: string;
}

export interface ReleaseChange {
  commit: ReleaseCommit;
  pullRequest: GithubPullRequest;
}

export interface ReleasePullRequestReader {
  readonly repository: string;
  getPullRequest(number: number): Promise<GithubPullRequest>;
  getPullRequestsForCommit(sha: string): Promise<GithubPullRequest[]>;
}

const recordSeparator = '\u001e';
const fieldSeparator = '\u001f';

export const releaseLogFormat = '%H%x1f%s%x1f%b%x1e';

export function parseReleaseLog(output: string): ReleaseCommit[] {
  return output
    .split(recordSeparator)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, ...body] = record.split(fieldSeparator);
      if (!sha || !subject) throw new Error('Git log содержит неполную запись релизного коммита.');
      return { sha, subject: subject.trim(), body: body.join(fieldSeparator).trim() };
    });
}

export function skipsReleaseNotes(commit: ReleaseCommit): boolean {
  return /(?:^|\n)Release-Notes:\s*skip(?:\s|$)/i.test(commit.body);
}

export function pullRequestNumber(commit: ReleaseCommit): number | undefined {
  const message = `${commit.subject}\n${commit.body}`;
  const patterns = [
    /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/i,
    /\(#(\d+)\)\s*$/m,
    /(?:^|\n)(?:Source-PR|Pull-Request|PR):\s*#(\d+)(?:\s|$)/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

export async function resolvePullRequest(
  commit: ReleaseCommit,
  github: ReleasePullRequestReader,
): Promise<GithubPullRequest> {
  const explicitNumber = pullRequestNumber(commit);
  if (explicitNumber) return github.getPullRequest(explicitNumber);

  const associated = (await github.getPullRequestsForCommit(commit.sha)).filter(
    (pullRequest) => pullRequest.base.ref === 'main',
  );
  if (associated.length === 1) return associated[0];
  if (associated.length > 1) {
    const numbers = associated.map(({ number }) => `#${number}`).join(', ');
    throw new Error(
      `Релизный commit ${commit.sha.slice(0, 7)} связан с несколькими PR в main (${numbers}). Добавьте явный trailer "Source-PR: #123".`,
    );
  }

  throw new Error(
    `Релизный commit ${commit.sha.slice(0, 7)} не связан с PR в main. Добавьте "(#123)", trailer "Source-PR: #123" или "Release-Notes: skip".`,
  );
}

export function formatReleaseNotes(changes: ReleaseChange[], repository: string): string {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error(`Некорректный GitHub repository: ${repository}.`);
  if (changes.length === 0) throw new Error('Между стабильными тегами нет публикуемых изменений.');

  const base = `https://github.com/${repository}`;
  const lines = changes.map(({ commit, pullRequest: pull }) => {
    const subject = commit.subject.replace(/\s*\(#\d+\)\s*$/, '').trim();
    return `- [\`${commit.sha.slice(0, 7)}\`](${base}/commit/${commit.sha}) ${subject} ([#${pull.number}](${pull.html_url})) — [@${pull.user.login}](${pull.user.html_url})`;
  });
  return `# Change Log\n\n${lines.join('\n')}\n`;
}

export function includesReleaseNotes(pullRequest: GithubPullRequest): boolean {
  return releaseKindForBranches([pullRequest.head.ref]) !== 'none';
}

export async function generateReleaseNotes(
  previousTag: string,
  target: string,
  github: ReleasePullRequestReader,
  git: GitClient,
): Promise<string> {
  const output = git.log(`${previousTag}..${target}`, releaseLogFormat, true);
  const commits = parseReleaseLog(output).filter((commit) => !skipsReleaseNotes(commit));
  const changes = (
    await Promise.all(
      commits.map(
        async (commit): Promise<ReleaseChange> => ({
          commit,
          pullRequest: await resolvePullRequest(commit, github),
        }),
      ),
    )
  ).filter(({ pullRequest }) => includesReleaseNotes(pullRequest));
  return formatReleaseNotes(changes, github.repository);
}
