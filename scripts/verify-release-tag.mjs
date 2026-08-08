import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { nextFeatureRelease, packageVersionFor, parseCandidateTag, parseStableRelease } from "./release-version.mjs";

const [tag] = process.argv.slice(2);
const candidate = parseCandidateTag(tag);
let release;

try {
  if (!tag) throw new Error("Тег не указан.");
  if (candidate) release = nextFeatureRelease(candidate.baseRelease);
  else {
    parseStableRelease(tag);
    release = tag;
  }
} catch {
  throw new Error(`Некорректный релизный тег: ${tag ?? "не указан"}.`);
}

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const expectedPackageVersion = packageVersionFor(release);
if (manifest.version !== expectedPackageVersion) {
  throw new Error(`Тег ${tag} должен выпускать ${release}, но package version равен ${manifest.version}.`);
}

console.log(`Релизный тег ${tag} соответствует выпуску ${release}.`);
