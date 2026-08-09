import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [nextVersion, ...extraArguments] = process.argv.slice(2);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!nextVersion || extraArguments.length > 0 || !semverPattern.test(nextVersion)) {
  console.error('Использование: pnpm version:set <semver>, например pnpm version:set 2.3.0');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const manifests = [resolve(root, 'apps/v2/package.json'), resolve(root, 'core/v2/package.json')];
const readmePath = resolve(root, 'README.md');
const readme = await readFile(readmePath, 'utf8');
const versionLinePattern = /(\*\*v2 · )[^*]+(\*\*)/;

if (!versionLinePattern.test(readme)) {
  throw new Error('В README не найдена строка версии v2.');
}

const updates = [];

for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version = nextVersion;
  updates.push(writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
}
updates.push(writeFile(readmePath, readme.replace(versionLinePattern, `$1${nextVersion}$2`), 'utf8'));
await Promise.all(updates);

console.log(`v2: версия приложения, движка и README изменена на ${nextVersion}`);
