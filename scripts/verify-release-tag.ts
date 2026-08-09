import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  isNextFeatureRelease,
  packageVersionFor,
  parseCandidateTag,
  parseStableRelease,
  stableReleaseForPackageVersion,
} from './release-version.ts';

export async function verifyReleaseTag(tag: string): Promise<string> {
  const candidate = parseCandidateTag(tag);
  const root = resolve(import.meta.dirname, '..');
  const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const manifestRelease = stableReleaseForPackageVersion(manifest.version);
  let release = manifestRelease;

  try {
    if (!tag) throw new Error('Тег не указан.');
    if (candidate) {
      if (!isNextFeatureRelease(candidate.baseRelease, manifestRelease)) {
        throw new Error(
          `Версия ${manifestRelease} не является следующим функциональным релизом после ${candidate.baseRelease}.`,
        );
      }
    } else {
      parseStableRelease(tag);
      release = tag;
    }
  } catch {
    throw new Error(`Некорректный релизный тег: ${tag || 'не указан'}.`);
  }

  const expectedPackageVersion = packageVersionFor(release);
  if (manifest.version !== expectedPackageVersion) {
    throw new Error(`Тег ${tag} должен выпускать ${release}, но package version равен ${manifest.version}.`);
  }

  return release;
}

async function main(): Promise<void> {
  const [tag] = process.argv.slice(2);
  const release = await verifyReleaseTag(tag);
  console.log(`Релизный тег ${tag} соответствует выпуску ${release}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
