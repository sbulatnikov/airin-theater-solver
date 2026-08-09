import { redactCredentials } from '../safe-environment.ts';
import type { GithubRequest, GithubTransport } from './transport.ts';

export type GithubFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GithubApiTransport implements GithubTransport {
  constructor(
    private readonly token: string,
    private readonly fetcher: GithubFetch = fetch,
  ) {
    if (!token) throw new Error('Github API transport требует token.');
  }

  async execute<T>({ method, path, body }: GithubRequest): Promise<T> {
    const response = await this.fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'airin-theater-solver-release-tools',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = 'response body omitted';
      try {
        const body = JSON.parse(text) as { message?: unknown };
        if (typeof body.message === 'string') message = body.message.slice(0, 500);
      } catch {}
      const safeMessage = redactCredentials(message, { GITHUB_TOKEN: this.token });
      throw new Error(`Github API ${method} ${path} вернул ${response.status}: ${safeMessage}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
