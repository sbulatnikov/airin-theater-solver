import { appendFile } from 'node:fs/promises';
import { stableTags } from '../rc/naming.ts';
import { requireEnvironment } from '../shared/command.ts';
import { GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { parseReleaseLog, releaseLogFormat, resolvePullRequest, skipsReleaseNotes } from './release-notes.ts';
import { releaseKindForBranches } from './release-policy.ts';

const sha = requireEnvironment('GITHUB_SHA');
const output = requireEnvironment('GITHUB_OUTPUT');
const git = new GitClientFactory().create();
const github = new GithubClientFactory().create();
const [previousTag] = stableTags(git.listTags('20*', { sort: '-version:refname' }).join('\n'));
if (!previousTag) throw new Error('В репозитории отсутствует предыдущий стабильный тег.');

const commits = parseReleaseLog(git.log(`${previousTag}..${sha}`, releaseLogFormat, true)).filter(
  (commit) => !skipsReleaseNotes(commit),
);
const pullRequests = await Promise.all(commits.map((commit) => resolvePullRequest(commit, github)));
const branches = [...new Set(pullRequests.map((pullRequest) => pullRequest.head.ref))];
const releaseKind = releaseKindForBranches(branches);
const shouldRelease = releaseKind !== 'none';

await appendFile(
  output,
  `should_release=${shouldRelease}\nrelease_kind=${releaseKind}\nprevious_tag=${previousTag}\n`,
  'utf8',
);
console.log(
  shouldRelease
    ? `Диапазон ${previousTag}..${sha.slice(0, 7)} выпускает ${releaseKind}; ветки: ${branches.join(', ')}.`
    : `Диапазон ${previousTag}..${sha.slice(0, 7)} содержит только ${branches.join(', ') || 'технические commits'}; release пропущен.`,
);
