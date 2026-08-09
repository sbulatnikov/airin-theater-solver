import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GitClientFactory } from '../shared/git.ts';
import { GithubClientFactory } from '../shared/github.ts';
import { generateReleaseNotes } from './release-notes.ts';

const [previousTag, target, outputPath] = process.argv.slice(2);
if (!previousTag || !target || !outputPath) {
  throw new Error('Использование: tsx scripts/release/generate-release-notes.ts <previous-tag> <target> <output-path>');
}

const github = new GithubClientFactory().create();
const git = new GitClientFactory().create();
const notes = await generateReleaseNotes(previousTag, target, github, git);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, notes, 'utf8');
console.log(`Сформирован Change Log для ${previousTag}..${target}: ${outputPath}`);
