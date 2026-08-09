import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { finalizeUnreleased } from '../changelog.ts';
import { stableTags } from '../rc/naming.ts';
import { setRepositoryRelease } from '../repository-release.ts';
import { requireEnvironment } from '../shared/command.ts';
import { GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { verifyReleaseTag } from '../verify-release-tag.ts';
import { assertChangelogRelease, planMainRelease } from './main-release.ts';
import { generateReleaseNotes } from './release-notes.ts';
import type { ReleaseKind } from './release-policy.ts';

const releaseKinds = new Set<ReleaseKind>(['feature', 'hotfix', 'none', 'prepared']);
const requestedKind = requireEnvironment('RELEASE_KIND');
if (!releaseKinds.has(requestedKind as ReleaseKind) || requestedKind === 'none') {
  throw new Error(`Некорректный тип выпуска: ${requestedKind}.`);
}
const releaseKind = requestedKind as Exclude<ReleaseKind, 'none'>;
const previousTag = requireEnvironment('PREVIOUS_TAG');
const triggeringSha = requireEnvironment('GITHUB_SHA');
const output = requireEnvironment('GITHUB_OUTPUT');
const git = new GitClientFactory().create();
const github = new GithubClientFactory().create();

async function skipSuperseded(reason: string): Promise<void> {
  console.log(reason);
  await appendFile(output, 'release_created=false\n', 'utf8');
}

git.fetch('origin', { tags: true });
const [latestStable] = stableTags(git.listTags('20*', { sort: '-version:refname' }).join('\n'));
if (latestStable !== previousTag) {
  await skipSuperseded(
    `Run устарел: предыдущим тегом был ${previousTag}, а актуальный стабильный тег — ${latestStable ?? 'не найден'}.`,
  );
} else {
  const currentMainSha = git.resolve('origin/main');
  if (currentMainSha !== triggeringSha) {
    await skipSuperseded(
      `Run для ${triggeringSha.slice(0, 7)} вытеснен новым main ${currentMainSha.slice(0, 7)}; выпуск обработает следующий run.`,
    );
  } else {
    await generateReleaseNotes(previousTag, triggeringSha, github, git);
    console.log(`Commit range ${previousTag}..${triggeringSha} готов для автоматического Change Log.`);

    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    const plan = planMainRelease(previousTag, manifest.version, releaseKind, new Date().getUTCFullYear());
    let releaseSha = triggeringSha;

    if (plan.prepareRepository) {
      const changelog = await readFile('CHANGELOG.md', 'utf8');
      const date = new Date().toISOString().slice(0, 10);
      await setRepositoryRelease(plan.release);
      await writeFile('CHANGELOG.md', finalizeUnreleased(changelog, plan.release, date), 'utf8');
      git.stage(['CHANGELOG.md', 'README.md', 'package.json']);
      if (!git.hasStagedChanges()) throw new Error(`Подготовка ${plan.release} не изменила release-файлы.`);
      git.commit({
        author: 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>',
        subject: `chore(release): prepare ${plan.release}`,
        body: 'Release-Notes: skip',
      });
      releaseSha = git.resolve('HEAD');
      git.pushBranch('main');
      console.log(`Версия ${plan.release} подготовлена bot-коммитом ${releaseSha.slice(0, 7)}.`);
    } else {
      assertChangelogRelease(await readFile('CHANGELOG.md', 'utf8'), plan.release);
    }

    await verifyReleaseTag(plan.release);
    if (git.tagExists(plan.release)) {
      const existingSha = git.commitFor(plan.release);
      if (existingSha !== releaseSha) {
        throw new Error(`Тег ${plan.release} уже указывает на другой commit: ${existingSha}.`);
      }
      console.log(`Тег ${plan.release} уже указывает на release commit.`);
    } else {
      git.createAnnotatedTag(plan.release, releaseSha, `Airin Theater Solver ${plan.release}`);
      git.pushTag(plan.release);
      console.log(`Создан стабильный тег ${plan.release}.`);
    }

    await appendFile(
      output,
      `release_created=true\nrelease_tag=${plan.release}\nprevious_tag=${previousTag}\n`,
      'utf8',
    );
  }
}
