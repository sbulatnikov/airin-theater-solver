import { parseCandidateTag, parseStableRelease } from "../release-version.ts";
import { gh, requireEnvironment, run, succeeds } from "../shared/command.ts";
import { verifyReleaseTag } from "../verify-release-tag.ts";

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

const branch = requireEnvironment("RC_BRANCH");
const sha = requireEnvironment("RC_SHA");
const repository = requireEnvironment("GITHUB_REPOSITORY");
const token = requireEnvironment("GITHUB_TOKEN");
const adminToken = requireEnvironment("REPOSITORY_ADMIN_TOKEN");
const candidateTag = branch.startsWith("rc/") ? branch.slice(3) : "";
const candidate = parseCandidateTag(candidateTag);
if (!candidate) throw new Error(`Некорректное имя RC-ветки: ${branch}.`);

const [latestStable] = stableTags(run("git", ["tag", "--list", "20*", "--sort=-version:refname"]));
if (candidate.baseRelease !== latestStable) {
  throw new Error(`RC основан на ${candidate.baseRelease}, последний стабильный релиз — ${latestStable}.`);
}

await verifyReleaseTag(candidateTag);
if (!succeeds("git", ["merge-base", "--is-ancestor", candidate.baseRelease, sha])) {
  throw new Error(`Commit ${sha} не является потомком ${candidate.baseRelease}.`);
}
if (succeeds("git", ["rev-parse", "--verify", `refs/tags/${candidateTag}`])) {
  throw new Error(`RC-тег уже существует: ${candidateTag}.`);
}

const rcBranches = [
  ...new Set(
    gh(
      [
        "api",
        "--paginate",
        `repos/${repository}/pulls?state=open&base=main&per_page=100`,
        "--jq",
        '.[] | select(.head.ref | startswith("rc/")) | .head.ref'
      ],
      token
    )
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
  )
];
if (rcBranches.length !== 1 || rcBranches[0] !== branch) {
  throw new Error(
    `Freeze требует единственный открытый RC PR для ${branch}; найдено: ${rcBranches.join(", ") || "нет"}.`
  );
}

const protection = {
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
  allow_fork_syncing: false
};
gh(
  ["api", "--method", "PUT", `repos/${repository}/branches/${encodeURIComponent(branch)}/protection`, "--input", "-"],
  adminToken,
  JSON.stringify(protection)
);

const tagObject = gh(
  [
    "api",
    "--method",
    "POST",
    `repos/${repository}/git/tags`,
    "-f",
    `tag=${candidateTag}`,
    "-f",
    `message=Airin Theater Solver ${candidateTag}`,
    "-f",
    `object=${sha}`,
    "-f",
    "type=commit",
    "--jq",
    ".sha"
  ],
  token
);
gh(
  [
    "api",
    "--method",
    "POST",
    `repos/${repository}/git/refs`,
    "-f",
    `ref=refs/tags/${candidateTag}`,
    "-f",
    `sha=${tagObject}`
  ],
  token
);

console.log(`RC ${candidateTag} заморожен: ветка заблокирована, тег создан.`);
