import { appendFile, readFile } from 'node:fs/promises';
import { nextMainRelease, parseStableRelease } from '../release-version.ts';
import { requireEnvironment } from '../shared/command.ts';
import { type GitClient, GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { verifyReleaseTag } from '../verify-release-tag.ts';
import { generateReleaseNotes } from './release-notes.ts';

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

async function resolveRelease(sha: string, git: GitClient): Promise<ResolvedRelease> {
  const currentTags = stableTags(git.listTags('20*', { pointsAt: sha }).join('\n'));
  const allTags = stableTags(git.listTags('20*', { sort: '-version:refname' }).join('\n'));
  if (currentTags.length > 1)
    throw new Error(`Commit уже имеет несколько стабильных тегов: ${currentTags.join(', ')}.`);
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
  if (!latestStable) throw new Error('В репозитории отсутствует предыдущий стабильный тег.');

  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  return { releaseTag: nextMainRelease(latestStable, manifest.version), previousTag: latestStable };
}

const sha = requireEnvironment('GITHUB_SHA');
const output = requireEnvironment('GITHUB_OUTPUT');
const github = new GithubClientFactory().create();
const git = new GitClientFactory().create();
const { releaseTag, previousTag } = await resolveRelease(sha, git);
await generateReleaseNotes(previousTag, sha, github, git);
console.log(`Commit range ${previousTag}..${sha} готов для автоматического Change Log.`);

if (git.tagExists(releaseTag)) {
  const existingSha = git.commitFor(releaseTag);
  if (existingSha !== sha) throw new Error(`Тег ${releaseTag} уже указывает на другой commit: ${existingSha}.`);
  console.log(`Тег ${releaseTag} уже указывает на текущий commit.`);
} else {
  git.createAnnotatedTag(releaseTag, sha, `Airin Theater Solver ${releaseTag}`);
  git.pushTag(releaseTag);
  console.log(`Создан стабильный тег ${releaseTag}.`);
}

await appendFile(output, `release_tag=${releaseTag}\nprevious_tag=${previousTag}\n`, 'utf8');
