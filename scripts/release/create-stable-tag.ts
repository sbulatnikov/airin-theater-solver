import { appendFile, readFile } from "node:fs/promises";
import { nextMainRelease, parseStableRelease } from "../release-version.ts";
import { gh, requireEnvironment, run, succeeds } from "../shared/command.ts";
import { verifyReleaseTag } from "../verify-release-tag.ts";
import { generateReleaseNotes } from "./release-notes.ts";

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

interface ResolvedRelease {
  releaseTag: string;
  previousTag: string;
}

async function resolveRelease(sha: string): Promise<ResolvedRelease> {
  const currentTags = stableTags(run("git", ["tag", "--points-at", sha, "--list", "20*"]));
  const allTags = stableTags(run("git", ["tag", "--list", "20*", "--sort=-version:refname"]));
  if (currentTags.length > 1)
    throw new Error(`Commit уже имеет несколько стабильных тегов: ${currentTags.join(", ")}.`);
  if (currentTags.length === 1) {
    await verifyReleaseTag(currentTags[0]);
    const currentIndex = allTags.indexOf(currentTags[0]);
    const previousTag = allTags[currentIndex + 1];
    if (currentIndex === -1 || !previousTag) {
      throw new Error(`Для ${currentTags[0]} отсутствует предыдущий стабильный тег.`);
    }
    return { releaseTag: currentTags[0], previousTag };
  }

  const [latestStable] = allTags;
  if (!latestStable) throw new Error("В репозитории отсутствует предыдущий стабильный тег.");

  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  return { releaseTag: nextMainRelease(latestStable, manifest.version), previousTag: latestStable };
}

const sha = requireEnvironment("GITHUB_SHA");
const repository = requireEnvironment("GITHUB_REPOSITORY");
const token = requireEnvironment("GITHUB_TOKEN");
const output = requireEnvironment("GITHUB_OUTPUT");
const { releaseTag, previousTag } = await resolveRelease(sha);
await generateReleaseNotes(previousTag, sha, repository, token);
console.log(`Commit range ${previousTag}..${sha} готов для автоматического Change Log.`);

if (succeeds("git", ["rev-parse", "--verify", `refs/tags/${releaseTag}`])) {
  const existingSha = run("git", ["rev-list", "-n", "1", releaseTag]);
  if (existingSha !== sha) throw new Error(`Тег ${releaseTag} уже указывает на другой commit: ${existingSha}.`);
  console.log(`Тег ${releaseTag} уже указывает на текущий commit.`);
} else {
  const tagObject = gh(
    [
      "api",
      "--method",
      "POST",
      `repos/${repository}/git/tags`,
      "-f",
      `tag=${releaseTag}`,
      "-f",
      `message=Airin Theater Solver ${releaseTag}`,
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
      `ref=refs/tags/${releaseTag}`,
      "-f",
      `sha=${tagObject}`
    ],
    token
  );
  console.log(`Создан стабильный тег ${releaseTag}.`);
}

await appendFile(output, `release_tag=${releaseTag}\nprevious_tag=${previousTag}\n`, "utf8");
