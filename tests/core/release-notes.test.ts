import { describe, expect, it } from "vitest";
import {
  formatReleaseNotes,
  parseReleaseLog,
  pullRequestNumber,
  type ReleaseChange,
  type ReleaseCommit,
  skipsReleaseNotes
} from "../../scripts/release/release-notes.ts";

const commit = (overrides: Partial<ReleaseCommit> = {}): ReleaseCommit => ({
  sha: "1234567890abcdef",
  subject: "fix(ci): repair release pipeline (#6)",
  body: "",
  ...overrides
});

const change = (overrides: Partial<ReleaseChange> = {}): ReleaseChange => ({
  commit: commit(),
  pullRequest: {
    number: 6,
    title: "Repair release pipeline",
    state: "open",
    draft: false,
    html_url: "https://github.com/sbulatnikov/airin-theater-solver/pull/6",
    head: { ref: "hotfix/release-pipeline", sha: "1234567890abcdef" },
    base: { ref: "main" },
    user: { id: 42, login: "backend", html_url: "https://github.com/backend" }
  },
  ...overrides
});

describe("release notes", () => {
  it("parses machine-delimited git log records", () => {
    const log =
      "1234567890abcdef\u001ffix: first (#6)\u001fBody\u001e\nabcdef1234567890\u001ffeat: second (#7)\u001f\u001e";
    expect(parseReleaseLog(log)).toEqual([
      { sha: "1234567890abcdef", subject: "fix: first (#6)", body: "Body" },
      { sha: "abcdef1234567890", subject: "feat: second (#7)", body: "" }
    ]);
  });

  it("recognizes explicit PR references and release housekeeping", () => {
    expect(pullRequestNumber(commit())).toBe(6);
    expect(pullRequestNumber(commit({ subject: "fix: pipeline", body: "Pull-Request: #17" }))).toBe(17);
    expect(pullRequestNumber(commit({ subject: "fix: resolve #42", body: "" }))).toBeUndefined();
    expect(skipsReleaseNotes(commit({ body: "Release-Notes: skip" }))).toBe(true);
  });

  it("creates a Change Log with commit, PR and contributor links", () => {
    expect(formatReleaseNotes([change()], "sbulatnikov/airin-theater-solver")).toBe(`# Change Log

- [\`1234567\`](https://github.com/sbulatnikov/airin-theater-solver/commit/1234567890abcdef) fix(ci): repair release pipeline ([#6](https://github.com/sbulatnikov/airin-theater-solver/pull/6)) — [@backend](https://github.com/backend)
`);
  });
});
