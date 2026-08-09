export function validateGithubRepository(repository: string): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Некорректный Github repository: ${repository}.`);
  }
  return repository;
}

export function parseGithubRepository(remoteUrl: string): string {
  const match = remoteUrl
    .trim()
    .match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https?:\/\/github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?$/i);
  if (!match) throw new Error(`Origin не является Github repository: ${remoteUrl}.`);
  return validateGithubRepository(match[1]);
}
