import { parseStableRelease } from "./release-version.ts";

export function finalizeUnreleased(changelog: string, release: string, date: string): string {
  parseStableRelease(release);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Некорректная дата релиза: ${date}.`);
  if (new RegExp(`^## ${release.replaceAll(".", "\\.")}(?:\\s|$)`, "m").test(changelog)) {
    throw new Error(`CHANGELOG.md уже содержит раздел ${release}.`);
  }

  const matches = [...changelog.matchAll(/^## Unreleased\s*$/gm)];
  if (matches.length !== 1)
    throw new Error(`CHANGELOG.md должен содержать ровно один раздел Unreleased, найдено: ${matches.length}.`);
  const heading = matches[0];
  const start = heading.index;
  const bodyStart = start + heading[0].length;
  const remainder = changelog.slice(bodyStart);
  const nextHeadingOffset = remainder.search(/^##\s+/m);
  const end = nextHeadingOffset === -1 ? changelog.length : bodyStart + nextHeadingOffset;
  const body = changelog.slice(bodyStart, end).trim();
  if (!body || !/^###\s+/m.test(body) || !/^-\s+/m.test(body)) {
    throw new Error("Раздел Unreleased должен содержать хотя бы одну категорию и один пункт.");
  }

  const prefix = changelog.slice(0, start);
  const suffix = changelog.slice(end).trimStart();
  return `${`${prefix}## Unreleased\n\n## ${release} — ${date}\n\n${body}\n\n${suffix}`.trimEnd()}\n`;
}
