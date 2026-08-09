import { appendFile } from 'node:fs/promises';
import { requireEnvironment } from '../shared/command.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { shouldReleaseForBranches } from './release-policy.ts';

const sha = requireEnvironment('GITHUB_SHA');
const output = requireEnvironment('GITHUB_OUTPUT');
const github = new GithubClientFactory().create();
const branches = [...new Set((await github.getPullRequestsForCommit(sha)).map((pull) => pull.head.ref))];
const shouldRelease = shouldReleaseForBranches(branches);

await appendFile(output, `should_release=${shouldRelease}\n`, 'utf8');
console.log(
  shouldRelease
    ? `Commit ${sha.slice(0, 7)} выпускает приложение; связанные ветки: ${branches.join(', ') || 'нет PR'}.`
    : `Commit ${sha.slice(0, 7)} относится только к ${branches.join(', ')}; release пропущен.`,
);
