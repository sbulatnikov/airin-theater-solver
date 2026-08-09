import { nextFeatureRelease, nextHotfixRelease } from './release-version.ts';

const [kind, currentRelease] = process.argv.slice(2);
const resolvers: Record<string, (currentRelease: string) => string> = {
  feature: nextFeatureRelease,
  hotfix: nextHotfixRelease,
};
const resolveRelease = resolvers[kind];

if (!resolveRelease || !currentRelease) {
  console.error('Использование: tsx scripts/next-release.ts <feature|hotfix> <current-release>');
  process.exit(1);
}

console.log(resolveRelease(currentRelease));
