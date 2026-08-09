import { setRepositoryRelease } from "./repository-release.ts";

const [release] = process.argv.slice(2);
if (!release) throw new Error("Использование: pnpm release:set <YYYY.R[.B]>, например pnpm release:set 2026.2");
await setRepositoryRelease(release);
console.log(`Релиз репозитория изменён на ${release}.`);
