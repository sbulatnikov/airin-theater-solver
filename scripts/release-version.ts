const stableReleasePattern = /^(20\d{2})\.([1-9]\d*)(?:\.([1-9]\d*))?$/;

export interface StableRelease {
  year: number;
  minor: number;
  patch?: number;
}

export interface CandidateTag {
  baseRelease: string;
  candidate: number;
}

export function parseStableRelease(release: string): StableRelease {
  const match = release?.match(stableReleasePattern);
  if (!match) throw new Error(`Некорректная стабильная версия: ${release ?? "не указана"}.`);

  return {
    year: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] === undefined ? undefined : Number(match[3])
  };
}

export function nextFeatureRelease(currentRelease: string, releaseYear = new Date().getFullYear()): string {
  const { year, minor } = parseStableRelease(currentRelease);
  if (!Number.isSafeInteger(releaseYear) || releaseYear < year) {
    throw new Error(`Год нового релиза ${releaseYear} не может быть меньше года текущего релиза ${year}.`);
  }
  if (releaseYear > year) return `${releaseYear}.1`;
  return `${year}.${minor + 1}`;
}

export function nextHotfixRelease(currentRelease: string): string {
  const { year, minor, patch } = parseStableRelease(currentRelease);
  return `${year}.${minor}.${(patch ?? 0) + 1}`;
}

export function isNextFeatureRelease(currentRelease: string, proposedRelease: string): boolean {
  const current = parseStableRelease(currentRelease);
  const proposed = parseStableRelease(proposedRelease);
  if (proposed.patch !== undefined) return false;
  if (proposed.year === current.year) return proposed.minor === current.minor + 1;
  return proposed.year > current.year && proposed.minor === 1;
}

export function packageVersionFor(release: string): string {
  parseStableRelease(release);
  return release.split(".").length === 2 ? `${release}.0` : release;
}

export function stableReleaseForPackageVersion(packageVersion: string): string {
  const match = packageVersion?.match(/^(20\d{2})\.([1-9]\d*)\.(\d+)$/);
  if (!match) throw new Error(`Некорректная версия package.json: ${packageVersion ?? "не указана"}.`);

  const [, year, minor, patch] = match;
  return Number(patch) === 0 ? `${year}.${minor}` : `${year}.${minor}.${patch}`;
}

export function nextMainRelease(currentRelease: string, packageVersion: string): string {
  const proposedRelease = stableReleaseForPackageVersion(packageVersion);
  const hotfixRelease = nextHotfixRelease(currentRelease);
  if (proposedRelease !== hotfixRelease && !isNextFeatureRelease(currentRelease, proposedRelease)) {
    throw new Error(
      `После ${currentRelease} main может выпустить только следующий функциональный релиз или ${hotfixRelease}, но package.json задаёт ${proposedRelease}.`
    );
  }
  return proposedRelease;
}

export function parseCandidateTag(tag: string): CandidateTag | undefined {
  const match = tag?.match(/^(20\d{2}\.[1-9]\d*(?:\.[1-9]\d*)?)-rc\.([1-9]\d*)$/);
  if (!match) return undefined;

  parseStableRelease(match[1]);
  return { baseRelease: match[1], candidate: Number(match[2]) };
}
