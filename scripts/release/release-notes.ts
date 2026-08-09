import type { GitClient } from '../shared/git.ts';
import type { GithubClient, GithubPullRequest } from '../shared/github.ts';

export interface ReleaseCommit {
  sha: string;
  subject: string;
  body: string;
}

export interface ReleaseChange {
  commit: ReleaseCommit;
  pullRequest: GithubPullRequest;
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

export async function generateReleaseNotes(
  previousTag: string,
  target: string,
  github: GithubClient,
  git: GitClient,
): Promise<string> {
  const output = git.log(`${previousTag}..${target}`, releaseLogFormat, true);
  const commits = parseReleaseLog(output).filter((commit) => !skipsReleaseNotes(commit));
  const changes = await Promise.all(
    commits.map(async (commit): Promise<ReleaseChange> => {
      const number = pullRequestNumber(commit);
      if (!number) {
        throw new Error(
          `Релизный commit ${commit.sha.slice(0, 7)} не содержит ссылку на PR. Добавьте "(#123)" или trailer "Release-Notes: skip".`,
        );
      }
      return { commit, pullRequest: await github.getPullRequest(number) };
    }),
  );
  return formatReleaseNotes(changes, github.repository);
}
