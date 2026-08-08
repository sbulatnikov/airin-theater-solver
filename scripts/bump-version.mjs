import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [generation, nextVersion] = process.argv.slice(2);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!new Set(["v1", "v2"]).has(generation) || !nextVersion || !semverPattern.test(nextVersion)) {
  console.error("Использование: pnpm version:set <v1|v2> <semver>, например pnpm version:set v2 2.3.0");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");
const manifests = [resolve(root, `apps/${generation}/package.json`), resolve(root, `core/${generation}/package.json`)];

for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = nextVersion;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

console.log(`${generation}: версия приложения и движка изменена на ${nextVersion}`);
