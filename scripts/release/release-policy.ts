export type ReleaseKind = 'feature' | 'hotfix' | 'none' | 'prepared';

export function releaseKindForBranches(branches: readonly string[]): ReleaseKind {
  const productBranches = branches.filter((branch) => !branch.startsWith('docs/') && !branch.startsWith('ci/'));
  if (productBranches.length === 0) return 'none';
  if (productBranches.some((branch) => branch.startsWith('rc/'))) return 'prepared';
  if (productBranches.every((branch) => branch.startsWith('hotfix/'))) return 'hotfix';
  return 'feature';
}

export function shouldReleaseForBranches(branches: string[]): boolean {
  return releaseKindForBranches(branches) !== 'none';
}
