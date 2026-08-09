import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GithubApiTransport,
  GithubClient,
  GithubClientFactory,
  GithubCliTransport,
  type GithubRequest,
  type GithubTransport,
  type GithubTransportFactory,
} from '../../scripts/shared/github.ts';

class RecordingTransport implements GithubTransport {
  readonly requests: GithubRequest[] = [];

  constructor(private readonly responses: unknown[] = []) {}

  async execute<T>(request: GithubRequest): Promise<T> {
    this.requests.push(request);
    return this.responses.shift() as T;
  }
}

afterEach(() => vi.unstubAllEnvs());

const pullRequest = {
  number: 6,
  title: 'Release pipeline',
  state: 'open' as const,
  draft: false,
  html_url: 'https://github.com/sbulatnikov/airin-theater-solver/pull/6',
  head: { ref: 'ci/release', sha: 'abc' },
  base: { ref: 'main' },
  user: { id: 42, login: 'backend', html_url: 'https://github.com/backend' },
};

describe('GithubClient', () => {
  it('encapsulates pull request API paths', async () => {
    const transport = new RecordingTransport([pullRequest, [pullRequest]]);
    const client = new GithubClient('sbulatnikov/airin-theater-solver', transport);

    await expect(client.getPullRequest(6)).resolves.toEqual(pullRequest);
    await expect(client.getOpenPullRequests()).resolves.toEqual([pullRequest]);
    expect(transport.requests).toEqual([
      { method: 'GET', path: '/repos/sbulatnikov/airin-theater-solver/pulls/6' },
      { method: 'GET', path: '/repos/sbulatnikov/airin-theater-solver/pulls?state=open&base=main&per_page=100' },
    ]);
  });
});

describe('Github transports', () => {
  it('GithubCliTransport delegates authentication and JSON to gh', async () => {
    vi.stubEnv('GH_DEBUG', 'api');
    vi.stubEnv('REPOSITORY_ADMIN_TOKEN', 'unrelated-admin-token');
    const executor = {
      run: vi.fn(() => '{"number":6}'),
      succeeds: vi.fn(() => true),
    };
    const transport = new GithubCliTransport(undefined, executor);

    await expect(
      transport.execute({ method: 'GET', path: '/repos/sbulatnikov/airin-theater-solver/pulls/6' }),
    ).resolves.toEqual({ number: 6 });
    expect(executor.run).toHaveBeenCalledWith(
      'gh',
      ['api', '--method', 'GET', 'repos/sbulatnikov/airin-theater-solver/pulls/6'],
      expect.objectContaining({ input: undefined }),
    );
    expect(executor.run.mock.calls[0][2].env.GH_DEBUG).toBeUndefined();
    expect(executor.run.mock.calls[0][2].env.REPOSITORY_ADMIN_TOKEN).toBeUndefined();
  });

  it('GithubApiTransport delegates authentication and JSON to HTTPS', async () => {
    const fetcher = vi.fn(async () => new Response('{"number":6}', { status: 200 }));
    const transport = new GithubApiTransport('actions-token', fetcher);

    await expect(
      transport.execute({ method: 'GET', path: '/repos/sbulatnikov/airin-theater-solver/pulls/6' }),
    ).resolves.toEqual({ number: 6 });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.github.com/repos/sbulatnikov/airin-theater-solver/pulls/6',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer actions-token' }),
      }),
    );
  });

  it('GithubApiTransport does not include response bodies or tokens in errors', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('{"message":"Bad credentials for actions-token","echoed":"actions-token"}', { status: 401 }),
    );
    const transport = new GithubApiTransport('actions-token', fetcher);

    const failure = transport.execute({ method: 'GET', path: '/repos/owner/repository/pulls/6' });
    await expect(failure).rejects.toThrow('Bad credentials');
    await expect(failure).rejects.not.toThrow('actions-token');
  });
});

describe('GithubClientFactory', () => {
  it('selects CLI locally and API in Github Actions', () => {
    const cli = new RecordingTransport();
    const api = new RecordingTransport();
    const transports: GithubTransportFactory = {
      createCli: vi.fn(() => cli),
      createApi: vi.fn(() => api),
    };

    const local = new GithubClientFactory({}, () => 'git@github.com:owner/repository.git', transports).create();
    const actions = new GithubClientFactory(
      { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'owner/repository', GITHUB_TOKEN: 'token' },
      () => 'unused',
      transports,
    ).create();

    expect(local.repository).toBe('owner/repository');
    expect(actions.repository).toBe('owner/repository');
    expect(transports.createCli).toHaveBeenCalledOnce();
    expect(transports.createApi).toHaveBeenCalledWith('token');
  });
});
