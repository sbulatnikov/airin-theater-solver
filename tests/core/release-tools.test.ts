import { describe, expect, it } from "vitest";
import { finalizeUnreleased } from "../../scripts/changelog.ts";
import { nextCandidateNumber, stableTags } from "../../scripts/rc/naming.ts";
import { parseGitHubRepository } from "../../scripts/shared/github.ts";

describe("release tools", () => {
  it("parses common GitHub origin URL formats", () => {
    expect(parseGitHubRepository("git@github.com:sbulatnikov/airin-theater-solver.git")).toBe(
      "sbulatnikov/airin-theater-solver"
    );
    expect(parseGitHubRepository("https://github.com/sbulatnikov/airin-theater-solver.git")).toBe(
      "sbulatnikov/airin-theater-solver"
    );
  });

  it("chooses the next unused candidate number for the latest stable release", () => {
    expect(nextCandidateNumber("2026.1", ["origin/rc/2026.1-rc.1", "2026.1-rc.3", "2025.2-rc.9"])).toBe(4);
    expect(stableTags("2026.1-rc.1\n2026.1\ninvalid\n2026.1.2")).toEqual(["2026.1", "2026.1.2"]);
  });

  it("moves Unreleased entries into a dated stable section and opens a new Unreleased section", () => {
    const changelog = `# Changelog

## Unreleased

### Добавлено

- Обучение.

## 2026.1 — 2026-08-09

- Первый релиз.
`;
    expect(finalizeUnreleased(changelog, "2026.2", "2026-09-15")).toBe(`# Changelog

## Unreleased

## 2026.2 — 2026-09-15

### Добавлено

- Обучение.

## 2026.1 — 2026-08-09

- Первый релиз.
`);
  });

  it("rejects an empty Unreleased section", () => {
    expect(() => finalizeUnreleased("# Changelog\n\n## Unreleased\n", "2026.2", "2026-09-15")).toThrow(
      "должен содержать"
    );
  });
});
