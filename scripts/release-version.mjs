const stableReleasePattern = /^(20\d{2})\.([1-9]\d*)(?:\.([1-9]\d*))?$/;

export function parseStableRelease(release) {
  const match = release?.match(stableReleasePattern);
  if (!match) throw new Error(`Некорректная стабильная версия: ${release ?? "не указана"}.`);

  return {
    year: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] === undefined ? undefined : Number(match[3])
  };
}

export function nextFeatureRelease(currentRelease) {
  const { year, minor } = parseStableRelease(currentRelease);
  return `${year}.${minor + 1}`;
}

export function nextHotfixRelease(currentRelease) {
  const { year, minor, patch } = parseStableRelease(currentRelease);
  return `${year}.${minor}.${(patch ?? 0) + 1}`;
}

export function packageVersionFor(release) {
  parseStableRelease(release);
  return release.split(".").length === 2 ? `${release}.0` : release;
}

export function stableReleaseForPackageVersion(packageVersion) {
  const match = packageVersion?.match(/^(20\d{2})\.([1-9]\d*)\.(\d+)$/);
  if (!match) throw new Error(`Некорректная версия package.json: ${packageVersion ?? "не указана"}.`);

  const [, year, minor, patch] = match;
  return Number(patch) === 0 ? `${year}.${minor}` : `${year}.${minor}.${patch}`;
}

export function nextMainRelease(currentRelease, packageVersion) {
  const proposedRelease = stableReleaseForPackageVersion(packageVersion);
  const allowedReleases = [nextFeatureRelease(currentRelease), nextHotfixRelease(currentRelease)];
  if (!allowedReleases.includes(proposedRelease)) {
    throw new Error(
      `После ${currentRelease} main может выпустить только ${allowedReleases.join(" или ")}, но package.json задаёт ${proposedRelease}.`
    );
  }
  return proposedRelease;
}

export function parseCandidateTag(tag) {
  const match = tag?.match(/^(20\d{2}\.[1-9]\d*(?:\.[1-9]\d*)?)-rc\.([1-9]\d*)$/);
  if (!match) return undefined;

  parseStableRelease(match[1]);
  return { baseRelease: match[1], candidate: Number(match[2]) };
}
