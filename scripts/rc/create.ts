import { nextFeatureRelease } from '../release-version.ts';
import { GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { nextCandidateNumber, stableTags } from './naming.ts';

const git = new GitClientFactory().create();
if (!git.isClean()) {
  throw new Error('Перед созданием RC рабочее дерево должно быть чистым.');
}

git.fetch('origin', { prune: true, tags: true });
const github = new GithubClientFactory().create();
const openPullRequests = await github.getOpenPullRequests();
const activeCandidates = openPullRequests.filter((pull) => pull.head.ref.startsWith('rc/'));
if (activeCandidates.length > 0) {
  throw new Error(
    `Уже существует активный RC PR: ${activeCandidates.map((pull) => `#${pull.number} (${pull.head.ref})`).join(', ')}.`,
  );
}

const [latestStable] = stableTags(
  git.listTags('20*', { sort: '-version:refname', mergedInto: 'origin/main' }).join('\n'),
);
if (!latestStable) throw new Error('В origin/main отсутствует стабильный релизный тег.');

const mainSha = git.resolve('origin/main');
const stableSha = git.commitFor(latestStable);
if (mainSha !== stableSha) {
  throw new Error(`origin/main (${mainSha.slice(0, 7)}) ещё не отмечен стабильным тегом; последний — ${latestStable}.`);
}

const refs = [...git.listBranches(), ...git.listTags(`${latestStable}-rc.*`)].filter(Boolean);
const candidate = nextCandidateNumber(latestStable, refs);
const branch = `rc/${latestStable}-rc.${candidate}`;
git.createBranch(branch, 'origin/main');

console.log(`Создана пустая ветка ${branch} от origin/main (${mainSha.slice(0, 7)}).`);
console.log(`Будущий функциональный релиз: ${nextFeatureRelease(latestStable)}.`);
console.log('Добавляйте только выбранные PR командой: pnpm rc:add <PR>.');
