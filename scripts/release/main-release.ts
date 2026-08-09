import {
  nextFeatureRelease,
  nextHotfixRelease,
  nextMainRelease,
  stableReleaseForPackageVersion,
} from '../release-version.ts';
import type { ReleaseKind } from './release-policy.ts';

export interface MainReleasePlan {
  prepareRepository: boolean;
  release: string;
}

export function planMainRelease(
  previousRelease: string,
  packageVersion: string,
  releaseKind: Exclude<ReleaseKind, 'none'>,
  releaseYear: number,
): MainReleasePlan {
  const repositoryRelease = stableReleaseForPackageVersion(packageVersion);
  if (releaseKind === 'prepared') {
    return {
      prepareRepository: false,
      release: nextMainRelease(previousRelease, packageVersion),
    };
  }

  const release =
    releaseKind === 'hotfix' ? nextHotfixRelease(previousRelease) : nextFeatureRelease(previousRelease, releaseYear);
  if (repositoryRelease === release) return { prepareRepository: false, release };
  if (repositoryRelease === previousRelease) return { prepareRepository: true, release };
  throw new Error(
    `После ${previousRelease} ветки типа ${releaseKind} должны выпустить ${release}, но package.json задаёт ${repositoryRelease}.`,
  );
}

export function assertChangelogRelease(changelog: string, release: string): void {
  const escapedRelease = release.replaceAll('.', '\\.');
  if (!new RegExp(`^## ${escapedRelease} — \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog)) {
    throw new Error(`CHANGELOG.md не содержит датированный раздел ${release}.`);
  }
}
