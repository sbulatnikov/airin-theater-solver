import { parseCandidateTag, parseStableRelease } from '../release-version.ts';
import { requireEnvironment } from '../shared/command.ts';
import { GitClientFactory } from '../shared/git.ts';
import { type GithubBranchProtection, GithubClientFactory } from '../shared/github.ts';
import { verifyReleaseTag } from '../verify-release-tag.ts';

function stableTags(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      try {
        parseStableRelease(tag);
        return true;
      } catch {
        return false;
      }
    });
}

const branch = requireEnvironment('RC_BRANCH');
const sha = requireEnvironment('RC_SHA');
const adminToken = requireEnvironment('REPOSITORY_ADMIN_TOKEN');
const git = new GitClientFactory().create();
const githubFactory = new GithubClientFactory();
const github = githubFactory.create();
const adminGithub = githubFactory.create({ repository: github.repository, token: adminToken });
const candidateTag = branch.startsWith('rc/') ? branch.slice(3) : '';
const candidate = parseCandidateTag(candidateTag);
if (!candidate) throw new Error(`Некорректное имя RC-ветки: ${branch}.`);

const [latestStable] = stableTags(git.listTags('20*', { sort: '-version:refname' }).join('\n'));
if (candidate.baseRelease !== latestStable) {
  throw new Error(`RC основан на ${candidate.baseRelease}, последний стабильный релиз — ${latestStable}.`);
}

await verifyReleaseTag(candidateTag);
if (!git.isAncestor(candidate.baseRelease, sha)) {
  throw new Error(`Commit ${sha} не является потомком ${candidate.baseRelease}.`);
}
if (git.tagExists(candidateTag)) {
  throw new Error(`RC-тег уже существует: ${candidateTag}.`);
}

const rcBranches = [
  ...new Set(
    (await github.getOpenPullRequests())
      .map((pull) => pull.head.ref)
      .filter((headBranch) => headBranch.startsWith('rc/')),
  ),
];
if (rcBranches.length !== 1 || rcBranches[0] !== branch) {
  throw new Error(
    `Freeze требует единственный открытый RC PR для ${branch}; найдено: ${rcBranches.join(', ') || 'нет'}.`,
  );
}

const protection: GithubBranchProtection = {
  required_status_checks: null,
  enforce_admins: true,
  required_pull_request_reviews: null,
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: true,
  allow_fork_syncing: false,
};
await adminGithub.protectBranch(branch, protection);
git.createAnnotatedTag(candidateTag, sha, `Airin Theater Solver ${candidateTag}`);
git.pushTag(candidateTag);

console.log(`RC ${candidateTag} заморожен: ветка заблокирована, тег создан.`);
