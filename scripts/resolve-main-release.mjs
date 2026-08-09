import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { nextMainRelease } from "./release-version.mjs";

const [currentRelease] = process.argv.slice(2);
if (!currentRelease) {
  console.error("Использование: node scripts/resolve-main-release.mjs <current-release>");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
console.log(nextMainRelease(currentRelease, manifest.version));
