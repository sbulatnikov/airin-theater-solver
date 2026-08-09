import { parseStableRelease } from '../release-version.ts';
import { requireEnvironment } from '../shared/command.ts';
import { GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { generateReleaseNotes } from './release-notes.ts';

const git = new GitClientFactory().create();
const github = new GithubClientFactory().create();
const target = requireEnvironment('GITHUB_SHA');
const previousTag = git.listTags('20*', { sort: '-version:refname' }).find((tag) => {
  try {
    parseStableRelease(tag);
    return true;
  } catch {
    return false;
  }
});

if (!previousTag) throw new Error('В репозитории отсутствует предыдущий стабильный тег.');

await generateReleaseNotes(previousTag, target, github, git);
console.log(`Release notes для ${previousTag}..${target} прошли предварительную проверку.`);
