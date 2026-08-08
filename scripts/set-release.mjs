import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [nextRelease] = process.argv.slice(2);
const releasePattern = /^(20\d{2})\.([1-9]\d*)(?:\.([1-9]\d*))?$/;
const match = nextRelease?.match(releasePattern);

if (!nextRelease || !match) {
  console.error("Использование: pnpm release:set <YYYY.R[.B]>, например pnpm release:set 2026.1");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const packagePath = resolve(root, "package.json");
const readmePath = resolve(root, "README.md");
const manifest = JSON.parse(await readFile(packagePath, "utf8"));
const readme = await readFile(readmePath, "utf8");
const readmePattern = /(Релиз репозитория: \*\*)[^*]+(\*\*)/;

if (!readmePattern.test(readme)) throw new Error("В README не найдена версия релиза репозитория.");

manifest.version = match[3] ? nextRelease : `${nextRelease}.0`;
await Promise.all([
  writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
  writeFile(readmePath, readme.replace(readmePattern, `$1${nextRelease}$2`), "utf8")
]);

console.log(`Релиз репозитория изменён на ${nextRelease} (package version ${manifest.version}).`);
