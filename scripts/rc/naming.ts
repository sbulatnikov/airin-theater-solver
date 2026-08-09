import { parseStableRelease } from "../release-version.ts";

export function stableTags(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag) => {
      try {
        parseStableRelease(tag);
        return true;
      } catch {
        return false;
      }
    });
}

export function nextCandidateNumber(baseRelease: string, refs: string[]): number {
  parseStableRelease(baseRelease);
  const escaped = baseRelease.replaceAll(".", "\\.");
  const pattern = new RegExp(`(?:^|/)${escaped}-rc\\.([1-9]\\d*)$`);
  const numbers = refs.flatMap((ref) => {
    const match = ref.match(pattern);
    return match ? [Number(match[1])] : [];
  });
  return Math.max(0, ...numbers) + 1;
}
