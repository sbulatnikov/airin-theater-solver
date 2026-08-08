import { nextFeatureRelease, nextHotfixRelease } from "./release-version.mjs";

const [kind, currentRelease] = process.argv.slice(2);
const resolvers = {
  feature: nextFeatureRelease,
  hotfix: nextHotfixRelease
};
const resolveRelease = resolvers[kind];

if (!resolveRelease || !currentRelease) {
  console.error("Использование: node scripts/next-release.mjs <feature|hotfix> <current-release>");
  process.exit(1);
}

console.log(resolveRelease(currentRelease));
