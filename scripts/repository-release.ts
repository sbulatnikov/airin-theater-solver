import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageVersionFor, parseStableRelease } from './release-version.ts';

export async function setRepositoryRelease(release: string, root = resolve(import.meta.dirname, '..')): Promise<void> {
  parseStableRelease(release);
  const packagePath = resolve(root, 'package.json');
  const readmePath = resolve(root, 'README.md');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  const readme = await readFile(readmePath, 'utf8');
  const readmePattern = /(Релиз репозитория: \*\*)[^*]+(\*\*)/;
  if (!readmePattern.test(readme)) throw new Error('В README не найдена версия релиза репозитория.');

  manifest.version = packageVersionFor(release);
  await Promise.all([
    writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
    writeFile(readmePath, readme.replace(readmePattern, `$1${release}$2`), 'utf8'),
  ]);
}
