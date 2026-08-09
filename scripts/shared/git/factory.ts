import { validateGithubRepository } from '../github/repository.ts';
import { GitCliTransport } from './cli-transport.ts';
import { GitClient } from './client.ts';
import type { GitTransport } from './transport.ts';

export interface GitClientOptions {
  repository?: string;
  token?: string;
}

export interface GitTransportFactory {
  create(token?: string): GitTransport;
}

export class DefaultGitTransportFactory implements GitTransportFactory {
  create(token?: string): GitTransport {
    return new GitCliTransport(undefined, token ? { token } : undefined);
  }
}

export class GitClientFactory {
  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly transports: GitTransportFactory = new DefaultGitTransportFactory(),
  ) {}

  create(options: GitClientOptions = {}): GitClient {
    const actions = this.environment.GITHUB_ACTIONS === 'true';
    const token = actions ? (options.token ?? this.environment.GITHUB_TOKEN) : undefined;
    const repository = options.repository ?? this.environment.GITHUB_REPOSITORY;
    if (actions && (!token || !repository)) {
      throw new Error('Публикация Git из Github Actions требует GITHUB_TOKEN и GITHUB_REPOSITORY.');
    }

    const transport = this.transports.create(token);
    const pushRemote =
      token && repository ? `https://github.com/${validateGithubRepository(repository)}.git` : 'origin';
    const tagger = actions
      ? {
          name: 'github-actions[bot]',
          email: '41898282+github-actions[bot]@users.noreply.github.com',
        }
      : undefined;
    return new GitClient(transport, { pushRemote, tagger });
  }
}
