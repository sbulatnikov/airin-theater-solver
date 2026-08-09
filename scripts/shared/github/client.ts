import { validateGithubRepository } from './repository.ts';
import type { GithubTransport } from './transport.ts';
import type { GithubBranchProtection, GithubPullRequest } from './types.ts';

export class GithubClient {
  readonly repository: string;

  constructor(
    repository: string,
    private readonly transport: GithubTransport,
  ) {
    this.repository = validateGithubRepository(repository);
  }

  async getPullRequest(number: number): Promise<GithubPullRequest> {
    if (!Number.isSafeInteger(number) || number < 1) throw new Error(`Некорректный номер PR: ${number}.`);
    return this.transport.execute<GithubPullRequest>({
      method: 'GET',
      path: `/repos/${this.repository}/pulls/${number}`,
    });
  }

  async getOpenPullRequests(base = 'main'): Promise<GithubPullRequest[]> {
    const query = new URLSearchParams({ state: 'open', base, per_page: '100' });
    return this.transport.execute<GithubPullRequest[]>({
      method: 'GET',
      path: `/repos/${this.repository}/pulls?${query.toString()}`,
    });
  }

  async getPullRequestsForCommit(sha: string): Promise<GithubPullRequest[]> {
    if (!/^[0-9a-f]{7,64}$/i.test(sha)) throw new Error(`Некорректный commit SHA: ${sha}.`);
    return this.transport.execute<GithubPullRequest[]>({
      method: 'GET',
      path: `/repos/${this.repository}/commits/${sha}/pulls`,
    });
  }

  async protectBranch(branch: string, protection: GithubBranchProtection): Promise<void> {
    await this.transport.execute({
      method: 'PUT',
      path: `/repos/${this.repository}/branches/${encodeURIComponent(branch)}/protection`,
      body: protection,
    });
  }
}
