import { nextFeatureRelease } from "../release-version.ts";
import { run } from "../shared/command.ts";
import { currentGitHubRepository, type GitHubPullRequest, githubRequest } from "../shared/github.ts";
import { nextCandidateNumber, stableTags } from "./naming.ts";

if (run("git", ["status", "--porcelain=v1"])) {
  throw new Error("Перед созданием RC рабочее дерево должно быть чистым.");
}

run("git", ["fetch", "--prune", "--tags", "origin"]);
const repository = currentGitHubRepository();
const openPullRequests = await githubRequest<GitHubPullRequest[]>(
  repository,
  "/pulls?state=open&base=main&per_page=100",
  process.env.GITHUB_TOKEN
);
const activeCandidates = openPullRequests.filter((pull) => pull.head.ref.startsWith("rc/"));
if (activeCandidates.length > 0) {
  throw new Error(
    `Уже существует активный RC PR: ${activeCandidates.map((pull) => `#${pull.number} (${pull.head.ref})`).join(", ")}.`
  );
}

const [latestStable] = stableTags(
  run("git", ["tag", "--list", "20*", "--sort=-version:refname", "--merged", "origin/main"])
);
if (!latestStable) throw new Error("В origin/main отсутствует стабильный релизный тег.");

const mainSha = run("git", ["rev-parse", "origin/main"]);
const stableSha = run("git", ["rev-list", "-n", "1", latestStable]);
if (mainSha !== stableSha) {
  throw new Error(`origin/main (${mainSha.slice(0, 7)}) ещё не отмечен стабильным тегом; последний — ${latestStable}.`);
}

const refs = [
  ...run("git", ["branch", "--all", "--format=%(refname:short)"]).split(/\r?\n/),
  ...run("git", ["tag", "--list", `${latestStable}-rc.*`]).split(/\r?\n/)
].filter(Boolean);
const candidate = nextCandidateNumber(latestStable, refs);
const branch = `rc/${latestStable}-rc.${candidate}`;
run("git", ["switch", "--create", branch, "origin/main"]);

console.log(`Создана пустая ветка ${branch} от origin/main (${mainSha.slice(0, 7)}).`);
console.log(`Будущий функциональный релиз: ${nextFeatureRelease(latestStable)}.`);
console.log("Добавляйте только выбранные PR командой: pnpm rc:add <PR>.");
