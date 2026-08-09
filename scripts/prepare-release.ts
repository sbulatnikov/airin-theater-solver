import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { finalizeUnreleased } from "./changelog.ts";
import { setRepositoryRelease } from "./repository-release.ts";

const [release] = process.argv.slice(2);
if (!release) throw new Error("Использование: pnpm release:prepare <YYYY.R[.B]>, например pnpm release:prepare 2026.2");

const root = resolve(import.meta.dirname, "..");
const changelogPath = resolve(root, "CHANGELOG.md");
const date = new Date().toISOString().slice(0, 10);
const changelog = finalizeUnreleased(await readFile(changelogPath, "utf8"), release, date);
await setRepositoryRelease(release, root);
await writeFile(changelogPath, changelog, "utf8");
console.log(`Unreleased подготовлен как ${release} от ${date}; package.json и README обновлены.`);
