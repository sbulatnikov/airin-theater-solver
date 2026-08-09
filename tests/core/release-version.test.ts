import { describe, expect, it } from "vitest";
import {
  nextFeatureRelease,
  nextHotfixRelease,
  nextMainRelease,
  packageVersionFor,
  parseCandidateTag,
  parseStableRelease,
  stableReleaseForPackageVersion
} from "../../scripts/release-version.mjs";

describe("repository release versions", () => {
  it("increments minor for a feature release and drops an existing patch", () => {
    expect(nextFeatureRelease("2026.1")).toBe("2026.2");
    expect(nextFeatureRelease("2026.1.4")).toBe("2026.2");
  });

  it("increments only patch for a hotfix", () => {
    expect(nextHotfixRelease("2026.1")).toBe("2026.1.1");
    expect(nextHotfixRelease("2026.1.4")).toBe("2026.1.5");
  });

  it("maps patchless CalVer to a valid package version", () => {
    expect(packageVersionFor("2026.2")).toBe("2026.2.0");
    expect(packageVersionFor("2026.2.1")).toBe("2026.2.1");
    expect(stableReleaseForPackageVersion("2026.2.0")).toBe("2026.2");
    expect(stableReleaseForPackageVersion("2026.2.1")).toBe("2026.2.1");
  });

  it("allows main to publish only the next feature or hotfix release", () => {
    expect(nextMainRelease("2026.1", "2026.2.0")).toBe("2026.2");
    expect(nextMainRelease("2026.1", "2026.1.1")).toBe("2026.1.1");
    expect(nextMainRelease("2026.1.4", "2026.2.0")).toBe("2026.2");
    expect(nextMainRelease("2026.1.4", "2026.1.5")).toBe("2026.1.5");
  });

  it("rejects a main update without a release bump", () => {
    expect(() => nextMainRelease("2026.1", "2026.1.0")).toThrow();
    expect(() => nextMainRelease("2026.1.2", "2026.1.2")).toThrow();
  });

  it("parses candidate tags without treating them as stable releases", () => {
    expect(parseCandidateTag("2026.1-rc.2")).toEqual({ baseRelease: "2026.1", candidate: 2 });
    expect(parseCandidateTag("2026.1.3-rc.4")).toEqual({
      baseRelease: "2026.1.3",
      candidate: 4
    });
    expect(parseCandidateTag("2026.1")).toBeUndefined();
  });

  it("rejects zero and incomplete stable versions", () => {
    expect(() => parseStableRelease("2026.0")).toThrow();
    expect(() => parseStableRelease("2026")).toThrow();
  });
});
