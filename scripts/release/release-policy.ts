export function shouldReleaseForBranches(branches: string[]): boolean {
  if (branches.some((branch) => branch.startsWith('rc/') || branch.startsWith('hotfix/'))) return true;
  return branches.length === 0 || branches.some((branch) => !branch.startsWith('docs/') && !branch.startsWith('ci/'));
}
